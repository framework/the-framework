import { useRef, useState } from 'react'
import { Button, Checkbox, Tooltip, TooltipContent, TooltipTrigger, cn, formatAge, formatDateTime, useModuleHost, usePolled, type ModulePageProps, type ModuleProject } from '@openagt/dashboard/module'
import type { PublishPick } from '../src/state.js'
import { PUBLISH_LABELS, decided, pace, publishChoices, publishes, readSchedulers, schedulerStatus, type SchedulerCommand, type SchedulerRow } from './schedulers.js'

// The Automations page: what starts by itself while nobody is at the keyboard. One group per
// project the page is given (every project that has this package, or the one picked in the
// dashboard), under its name and its scheduler's status; one row per command the project's skills
// schedule, as the project's scheduler last read them. A row holds the command, what its skill says
// it does, when it runs in the skill's plain words, how far its runs publish, what the scheduler
// last decided for it, and its switch. "Edit" opens the row in place to pick how far its runs
// publish; one row is open at a time. All of it is this machine's, read with
// `agent-scheduler status` and saved with `switch` and `publish`: no tracked file changes. A
// command is off until its switch is flipped here, and commits its work until a level is picked here.

const EMPTY: SchedulerRow[] = []

/** The tick's note that says the project schedules nothing: the page says it in its own words under the heading. */
const NOTHING_SCHEDULED = 'no skill of this project schedules a command'

export function AutomationsPage({ projects }: ModulePageProps) {
  const host = useModuleHost()
  const key = projects.map(p => p.id).join(',')
  const { value: rows, loaded, reload } = usePolled(() => readSchedulers(host, projects), EMPTY, 10_000, [key])
  /** The rows with a save waiting or in flight, each as often as it has one. */
  const [busy, setBusy] = useState<readonly string[]>([])
  /** The last save that was not taken, on the row it was for. */
  const [failed, setFailed] = useState<{ id: string; text: string } | undefined>()
  /** The row open for editing, and the publish pick made in it and not saved yet. */
  const [editing, setEditing] = useState<{ id: string; publish: PublishPick } | undefined>()
  /** Which row is open, as of now: a save answers long after the click that started it. */
  const openId = useRef<string | undefined>(undefined)
  const edit = (next: { id: string; publish: PublishPick } | undefined): void => {
    openId.current = next?.id
    setEditing(next)
  }
  const editButtons = useRef(new Map<string, HTMLButtonElement>())
  /** Close the row and hand the keyboard back to its Edit button; nothing when the person has opened another row since. */
  const close = (id: string): void => {
    if (openId.current !== id) return
    edit(undefined)
    setTimeout(() => editButtons.current.get(id)?.focus())
  }
  // Saves go one at a time: each is a command that reads the state file, changes it and writes it
  // back. A row stays held until what it saved has been read back, so it never shows the old value
  // as if nothing had happened. A command that could not even be asked is a save not taken, and
  // the next save still runs.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const save = (what: string, id: string, project: ModuleProject, args: string[], then?: () => void): void => {
    setBusy(current => [...current, id])
    setFailed(current => (current?.id === id ? undefined : current))
    queue.current = queue.current.then(async () => {
      const answer = await host.runCommand(project.id, args).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }))
      await reload().catch(() => {})
      setBusy(current => current.filter((_, index) => index !== current.indexOf(id)))
      if (answer.ok) then?.()
      else setFailed({ id, text: `The ${what} was not saved: ${answer.error}` })
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <h1 className="text-lg font-semibold">Automations</h1>
      <p className="mt-1 text-sm text-muted-foreground">What starts by itself while nobody is at the keyboard. Your choices, on this machine. Every row starts switched off.</p>
      {!loaded && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {rows.map(row => {
        const status = schedulerStatus(row)
        const note = row.lastTick?.note
        return (
          <section key={row.project.id} aria-label={row.project.name} className="mt-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
              <h2 className="text-sm font-semibold">{row.project.name}</h2>
              <span className={cn('text-xs font-medium', status.tone)}>Scheduler {status.label}</span>
              {row.model && <span className="text-xs text-muted-foreground">{row.model}</span>}
              {row.lastTick && (
                <span className="text-xs text-muted-foreground">
                  last tick{' '}
                  <Tooltip>
                    <TooltipTrigger render={<span className="tabular-nums" />}>{formatAge(row.lastTick.at)}</TooltipTrigger>
                    <TooltipContent>{formatDateTime(row.lastTick.at)}</TooltipContent>
                  </Tooltip>
                  {/* Why that tick decided nothing, when it says: a pull that failed. "off" is the status beside the name, and a project that schedules nothing says so below. */}
                  {note !== undefined && note !== 'off' && note !== NOTHING_SCHEDULED && `: ${note}`}
                </span>
              )}
            </div>
            {row.error !== undefined && <p role="alert" className="py-3 text-sm text-danger">{`The scheduler could not be read: ${row.error}`}</p>}
            {row.error === undefined && !row.on && <p className="py-3 text-sm text-muted-foreground">The scheduler is off in this project, so nothing here starts. It starts with the dashboard once the project has run `npx agent-scheduler init`, or by hand with `npx agent-scheduler start`.</p>}
            {row.error === undefined && row.on && !row.running && <p className="py-3 text-sm text-warning">The scheduler is on but its process is not running, so nothing here starts. `npx agent-scheduler start`, run in the project, starts it.</p>}
            {row.unreadable.map(({ skill, reason }) => (
              <p key={skill} role="alert" className="py-3 text-sm text-danger">{`The schedule of the ${skill} skill cannot be read, so it is not listed: ${reason}`}</p>
            ))}
            {row.error === undefined && row.commands.length === 0 && row.unreadable.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">{row.lastTick ? 'Nothing here: no skill of this project says it can be scheduled.' : 'Nothing here yet: the scheduler of this project has not looked at its skills.'}</p>
            )}
            {row.commands.length > 0 && (
              <ul className="divide-y divide-border">
                {row.commands.map(scheduled => {
                  const id = `${row.project.id}/${scheduled.command}`
                  const saving = busy.includes(id)
                  const open = editing?.id === id ? editing : undefined
                  return (
                    <li key={id} aria-label={`/${scheduled.command}`} className={cn('py-3', saving && 'opacity-60')}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-sm">/{scheduled.command}</p>
                          {scheduled.description && <p className="line-clamp-2 text-sm text-muted-foreground">{scheduled.description}</p>}
                          {!open && <Summary host={host} project={row.project} scheduled={scheduled} />}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {!open && (
                            <button
                              type="button"
                              ref={button => {
                                if (button) editButtons.current.set(id, button)
                                else editButtons.current.delete(id)
                              }}
                              disabled={saving}
                              onClick={() => edit({ id, publish: scheduled.publish })}
                              aria-label={`Edit /${scheduled.command}`}
                              className="text-xs underline disabled:opacity-50"
                            >
                              Edit
                            </button>
                          )}
                          <Checkbox
                            checked={scheduled.on}
                            disabled={saving}
                            onCheckedChange={next => save('switch', id, row.project, ['switch', scheduled.command, next === true ? 'on' : 'off'])}
                            aria-label={`Run /${scheduled.command} by itself`}
                          />
                        </div>
                      </div>
                      {open && (
                        <div
                          role="group"
                          aria-label={`Editing /${scheduled.command}`}
                          onKeyDown={e => {
                            if (e.key === 'Escape' && !saving) close(id)
                          }}
                          className="mt-3 rounded-md border border-border bg-muted/40 p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What its runs publish</p>
                          <select
                            // The keyboard lands where the row opened.
                            autoFocus
                            value={open.publish}
                            disabled={saving}
                            onChange={e => edit({ id, publish: e.target.value as PublishPick })}
                            aria-label="What its runs publish"
                            className="mt-2 rounded-md border border-border bg-background px-2 py-1 text-sm"
                          >
                            {publishChoices(row.project.gitHost, open.publish).map(pick => (
                              <option key={pick} value={pick}>
                                {PUBLISH_LABELS[pick]}
                              </option>
                            ))}
                          </select>
                          <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm">{`${pace(scheduled)}. ${publishes({ ...scheduled, publish: open.publish })}.`}</p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">Saved for you, in this project, on this machine. No tracked file changes.</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" disabled={saving} onClick={() => close(id)}>
                                Cancel
                              </Button>
                              <Button size="sm" disabled={saving} onClick={() => (open.publish === scheduled.publish ? close(id) : save('publish pick', id, row.project, ['publish', scheduled.command, open.publish], () => close(id)))}>
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {failed?.id === id && (
                        <p role="alert" className="mt-2 text-xs text-danger">
                          {failed.text}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** A row's one line: when the command runs, how far its runs publish, and what the scheduler last decided for it; a decision that started a run opens that agent. */
function Summary({ host, project, scheduled }: { host: ReturnType<typeof useModuleHost>; project: ModuleProject; scheduled: SchedulerCommand }) {
  const last = decided(scheduled)
  const run = scheduled.decision?.run
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
      <span>{pace(scheduled)}</span>
      <span aria-hidden>·</span>
      <span>{publishes(scheduled)}</span>
      {last !== undefined && (
        <>
          <span aria-hidden>·</span>
          {run !== undefined && scheduled.on ? (
            <button type="button" onClick={() => host.openAgent(project.id, run)} className="underline hover:text-foreground">
              {last}
            </button>
          ) : (
            <span>{last}</span>
          )}
        </>
      )}
    </p>
  )
}
