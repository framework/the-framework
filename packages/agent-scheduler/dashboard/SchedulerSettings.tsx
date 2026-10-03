import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Checkbox, SettingsRow, SettingsSection, cn, useModuleHost, usePolled, type ModuleSettingsProps } from 'framework/module'
import type { PublishPick } from '../src/state.js'
import { MAX_SPEND_OFFSET, PUBLISH_LABELS, loosestSpendOffset, offsetsThatDiffer, pace, publishChoices, publishes, readSchedulers, saveSpendOffset, schedulerStatus, typedOffset, type Saved, type SchedulerRow } from './schedulers.js'

// Settings → Scheduler, in groups that say what a setting reaches: "All projects" holds the one
// number saved to every project, how far past the quota boundary scheduled work may still start;
// then one group per project, under its name and its scheduler's status, holds, for
// each command of the project's schedule (`agent-schedule.md`) as the project's scheduler last
// read it, a switch and a publish menu. All of it is this machine's, read with
// `agent-scheduler status` and saved with `agent-scheduler offset`, `switch` and `publish`; what
// the schedule line says is the default. A project whose scheduler has not ticked yet lists no
// command.

const EMPTY: SchedulerRow[] = []

/** How long the offset rests before it is saved: typing a number is several changes, each a command per project. */
const OFFSET_SAVE_DELAY_MS = 500

export function SchedulerSettings({ projects }: ModuleSettingsProps) {
  const host = useModuleHost()
  const key = projects.map(p => p.id).join(',')
  const { value: rows, reload } = usePolled(() => readSchedulers(host, projects), EMPTY, 10_000, [key])
  const [busy, setBusy] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  // Saves go one at a time: each is a command that reads the state file, changes it and writes it back.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const save = (what: string, row: string | undefined, send: () => Promise<Saved>): void => {
    setBusy(row)
    setError(undefined)
    queue.current = queue.current.then(async () => {
      const saved = await send()
      setBusy(current => (current === row ? undefined : current))
      if (!saved.ok) setError(`The ${what} was not saved: ${saved.error}`)
      reload()
    })
  }

  // The offset as typed, kept until a read made after the save brings it back.
  const read = loosestSpendOffset(rows)
  const [typed, setTyped] = useState<number | undefined>()
  const [text, setText] = useState<string | undefined>()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (typed !== undefined && read === typed) setTyped(undefined)
  }, [read, typed])
  useEffect(() => () => clearTimeout(timer.current), [])
  const offset = typed ?? read
  const setOffset = (points: number): void => {
    setTyped(points)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      save('spend offset', undefined, async () => {
        const saved = await saveSpendOffset(host, projects, points)
        if (!saved.ok) setTyped(undefined)
        return saved
      })
    }, OFFSET_SAVE_DELAY_MS)
  }
  const command = (project: { id: string }, args: string[]) => async (): Promise<Saved> => {
    const answer = await host.runCommand(project.id, args)
    return answer.ok ? { ok: true } : { ok: false, error: `/${args[1]}: ${answer.error}` }
  }

  const differing = offsetsThatDiffer(rows)
  if (projects.length === 0) return null
  return (
    <SettingsSection title="Scheduler" description="What each project's scheduler starts while nobody is at the keyboard, on this machine.">
      {offset !== undefined && (
        <div role="group" aria-label="All projects" className="divide-y divide-border">
          <GroupHeading title="All projects" />
          <SettingsRow
            label="Spend offset"
            description={`How far every project's scheduler may start work past the quota boundary, in percentage points (max ${MAX_SPEND_OFFSET}). Negative holds it back; positive lets it borrow from the days ahead. One number, saved to every project; the handle on the usage bar moves the same number.${differing.length > 0 ? ` Shown: the loosest. ${differing.map(d => `${d.name} is at ${d.offset}`).join(', ')}; saving sets every project to the same number.` : ''}`}
            control={
              <input
                type="number"
                // The text as typed while the field has the focus, so a number can be typed through a state that is none yet ("-").
                value={text ?? String(Math.round(offset * 10) / 10)}
                min={-MAX_SPEND_OFFSET}
                max={MAX_SPEND_OFFSET}
                onChange={e => {
                  const raw = e.target.value
                  setText(raw)
                  // Held to the handle's reach here as well as on the input: `min`/`max` only constrain the spinner.
                  const points = typedOffset(raw)
                  if (points !== undefined) setOffset(points)
                }}
                onBlur={() => setText(undefined)}
                aria-label="Spend offset"
                className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            }
          />
        </div>
      )}
      {rows.map(row => {
        const status = schedulerStatus(row)
        return (
          <div key={row.project.id} role="group" aria-label={row.project.name} className="divide-y divide-border">
            <GroupHeading title={row.project.name} note="On this machine only; agent-schedule.md sets the defaults.">
              <span className={cn('text-xs font-medium', status.tone)}>{status.label}</span>
              {row.model && <span className="text-xs text-muted-foreground">{row.model}</span>}
            </GroupHeading>
            {row.error !== undefined && <p role="alert" className="py-2 text-xs text-danger">{`The scheduler could not be read: ${row.error}`}</p>}
            {row.error === undefined && row.commands.length === 0 && <p className="py-2 text-xs text-muted-foreground">No scheduled command yet: this project's scheduler has not read a schedule.</p>}
            {row.commands.map(scheduled => {
              const label = `Run /${scheduled.command} on a schedule`
              const id = `${row.project.id}/${scheduled.command}`
              const saving = busy === id
              return (
                <SettingsRow
                  key={id}
                  label={label}
                  description={`${pace(scheduled)} · ${publishes(scheduled)}`}
                  dimmed={saving}
                  control={
                    <div className="flex items-center gap-3">
                      <select
                        value={scheduled.publishPick ?? ''}
                        disabled={saving}
                        onChange={e => save('publish pick', id, command(row.project, ['publish', scheduled.command, e.target.value === '' ? 'file' : (e.target.value as PublishPick)]))}
                        aria-label={`What /${scheduled.command} publishes`}
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      >
                        <option value="">As the file says ({PUBLISH_LABELS[scheduled.publish ?? 'nothing']})</option>
                        {publishChoices(row.project.gitHost, scheduled.publishPick).map(pick => (
                          <option key={pick} value={pick}>
                            {PUBLISH_LABELS[pick]}
                          </option>
                        ))}
                      </select>
                      <Checkbox checked={scheduled.on} disabled={saving} onCheckedChange={next => save('switch', id, command(row.project, ['switch', scheduled.command, next === true ? 'on' : 'off']))} aria-label={label} />
                    </div>
                  }
                />
              )
            })}
          </div>
        )
      })}
      {error !== undefined && (
        <p role="alert" className="py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </SettingsSection>
  )
}

/** A group's heading inside the section: whose settings follow (every project's, or one project's), what is beside the name, and one line under it. */
function GroupHeading({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="pt-5 pb-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        {children}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
