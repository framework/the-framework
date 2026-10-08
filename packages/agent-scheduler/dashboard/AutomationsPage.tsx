import { useRef, useState } from 'react'
import { Button, Checkbox, Tooltip, TooltipContent, TooltipTrigger, cn, formatAge, formatDateTime, useModuleHost, usePolled, type ModulePageProps, type ModuleProject } from '@openagt/dashboard/module'
import type { PublishPick } from '../src/state.js'
import { MAX_AGENTS } from '../src/names.js'
import { MAX_COUNT, PACE_UNITS, parseInterval, takesTimeOfDay, type PaceUnit } from '../src/pace.js'
import { PUBLISH_LABELS, UNIT_WORDS, agentsArgs, agentsDraftOf, atOnce, atOnceWords, decided, saysAtOnce, draftOf, ownPace, pace, paceArgs, paceProblem, publishChoices, publishes, readSchedulers, schedulerStatus, withAgentsDraft, withDraft, type AgentsDraft, type PaceDraft, type SchedulerCommand, type SchedulerRow } from './schedulers.js'

// The Automations page: what starts by itself while nobody is at the keyboard. One group per
// project the page is given (every project that has this package, or the one picked in the
// dashboard), under its name and its scheduler's status; one row per command the project's skills
// schedule, as the project's scheduler last read them. A row holds the command, what its skill says
// it does, when it runs in the skill's plain words, how far its runs publish, what the scheduler
// last decided for it, and its switch. "Edit" opens the row in place to pick when it runs (as its
// skill says, whenever there is work, or every so many minutes, hours, days, weeks or months, with
// a time of day for days or more), how many agents may work on it at once, and how far its runs
// publish; one row is open at a time. All of it is this machine's, read with
// `agent-scheduler status` and saved with `switch`, `pace`, `agents` and `publish`: no tracked file
// changes. A command is off until its switch is flipped here, runs at its skill's pace and with its
// skill's number of agents until others are picked here, and commits its work until a level is
// picked here.

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
  /** The row open for editing, and the pace, the number of agents and the publish pick made in it and not saved yet. */
  const [editing, setEditing] = useState<Editing | undefined>()
  /** Which row is open, as of now: a save answers long after the click that started it. */
  const openId = useRef<string | undefined>(undefined)
  const edit = (next: Editing | undefined): void => {
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

  /** Save what the open row changed, the pace, then the number of agents, then the publish pick, each a command of its own and each only once the one before it is taken; the row closes once the last one is taken, and at once when nothing changed. A save not taken leaves the row open with what was picked. */
  const saveRow = (id: string, project: ModuleProject, scheduled: SchedulerCommand, open: Editing): void => {
    const paced = paceArgs(open.pace)
    const counted = agentsArgs(open.agents)
    if (!paced || !counted) return
    const saves: [what: string, args: string[]][] = []
    if (paced.join(' ') !== paceArgs(draftOf(scheduled))!.join(' ')) saves.push(['pace', ['pace', scheduled.command, ...paced]])
    if (counted[0] !== agentsArgs(agentsDraftOf(scheduled))![0]) saves.push(['number of agents', ['agents', scheduled.command, ...counted]])
    if (open.publish !== scheduled.publish) saves.push(['publish pick', ['publish', scheduled.command, open.publish]])
    const step = (index: number): void => {
      const next = saves[index]
      if (!next) return close(id)
      save(next[0], id, project, next[1], () => step(index + 1))
    }
    step(0)
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
                              onClick={() => edit({ id, publish: scheduled.publish, pace: draftOf(scheduled), agents: agentsDraftOf(scheduled) })}
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
                          <PaceFields scheduled={scheduled} draft={open.pace} disabled={saving} onChange={next => edit({ ...open, pace: next })} />
                          <AgentsFields scheduled={scheduled} draft={open.agents} disabled={saving} onChange={next => edit({ ...open, agents: next })} />
                          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What its runs publish</p>
                          <select
                            value={open.publish}
                            disabled={saving}
                            onChange={e => edit({ ...open, publish: e.target.value as PublishPick })}
                            aria-label="What its runs publish"
                            className="mt-2 rounded-md border border-border bg-background px-2 py-1 text-sm"
                          >
                            {publishChoices(row.project.gitHost, open.publish).map(pick => (
                              <option key={pick} value={pick}>
                                {PUBLISH_LABELS[pick]}
                              </option>
                            ))}
                          </select>
                          <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                            {paceProblem(open.pace) ?? (agentsArgs(open.agents) ? `${pace(withDraft(scheduled, open.pace))}. ${saysAtOnce(withAgentsDraft(scheduled, open.agents)) ? `${atOnceWords(atOnce(withAgentsDraft(scheduled, open.agents)))}. ` : ''}${publishes({ ...scheduled, publish: open.publish })}.` : `Type a whole number of agents, from 1 to ${MAX_AGENTS}.`)}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">Saved for you, in this project, on this machine. No tracked file changes.</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" disabled={saving} onClick={() => close(id)}>
                                Cancel
                              </Button>
                              <Button size="sm" disabled={saving || !paceArgs(open.pace) || !agentsArgs(open.agents)} onClick={() => saveRow(id, row.project, scheduled, open)}>
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

const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1)

/** A row open for editing: which one, and what the person picked in it and has not saved yet. */
interface Editing {
  id: string
  publish: PublishPick
  pace: PaceDraft
  agents: AgentsDraft
}

/**
 * "How many at once", in an open row: as the skill says, or up to a number the person types. The
 * number is held against the agents of every machine that shares the repository, and a new agent
 * still starts only when the row is due by its pace and its check.
 */
function AgentsFields({ scheduled, draft, disabled, onChange }: { scheduled: SchedulerCommand; draft: AgentsDraft; disabled: boolean; onChange: (next: AgentsDraft) => void }) {
  const skills = scheduled.skillAgents ?? 1
  const typed = draft.kind === 'own' ? draft : { kind: 'own' as const, count: String(skills) }
  const name = `how many of /${scheduled.command} at once`
  return (
    <fieldset disabled={disabled} className="mt-4 space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How many at once</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={name} checked={draft.kind === 'skill'} onChange={() => onChange({ kind: 'skill' })} />
        As the skill says
        <span className="text-xs text-muted-foreground">{lower(atOnceWords(skills))}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name={name} checked={draft.kind === 'own'} onChange={() => onChange(typed)} />
          Up to
        </label>
        <input
          type="number"
          min={1}
          max={MAX_AGENTS}
          value={typed.count}
          disabled={draft.kind !== 'own'}
          onChange={e => onChange({ kind: 'own', count: e.target.value })}
          aria-label="How many agents"
          className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
        />
        <span>{Number(typed.count) === 1 ? 'agent' : 'agents'} at once</span>
      </div>
      <p className="text-xs text-muted-foreground">A new one starts only when the row is due, and only while fewer than this are working on any machine that shares this repository.</p>
    </fieldset>
  )
}

/**
 * "When it runs", in an open row: as the skill says, whenever there is work (only for a command
 * with a check), or every so many of a unit, with a time of day beside days, weeks or months.
 * Picking the third without a count yet starts from the skill's own interval, else one day.
 */
function PaceFields({ scheduled, draft, disabled, onChange }: { scheduled: SchedulerCommand; draft: PaceDraft; disabled: boolean; onChange: (next: PaceDraft) => void }) {
  const skills = scheduled.every === undefined ? undefined : parseInterval(scheduled.every)
  const typed = draft.kind === 'every' ? draft : { kind: 'every' as const, count: String(skills?.count ?? 1), unit: skills?.unit ?? ('d' as PaceUnit), at: '' }
  const timed = takesTimeOfDay({ count: 1, unit: typed.unit, ms: 0, text: '' })
  const name = `when /${scheduled.command} runs`
  const field = 'rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50'
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When it runs</legend>
      <label className="flex items-center gap-2 text-sm">
        {/* The keyboard lands where the row opened. */}
        <input type="radio" name={name} autoFocus={draft.kind === 'skill'} checked={draft.kind === 'skill'} onChange={() => onChange({ kind: 'skill' })} />
        As the skill says
        <span className="text-xs text-muted-foreground">{lower(pace(withDraft(scheduled, { kind: 'skill' })))}</span>
      </label>
      {scheduled.when !== undefined && scheduled.every !== undefined && (
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name={name} autoFocus={draft.kind === 'work'} checked={draft.kind === 'work'} onChange={() => onChange({ kind: 'work' })} />
          Whenever there is work
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name={name} autoFocus={draft.kind === 'every'} checked={draft.kind === 'every'} onChange={() => onChange(typed)} />
          Every
        </label>
        <input
          type="number"
          min={1}
          max={MAX_COUNT}
          value={typed.count}
          disabled={draft.kind !== 'every'}
          onChange={e => onChange({ ...typed, count: e.target.value })}
          aria-label="How many"
          className={cn(field, 'w-20')}
        />
        <select value={typed.unit} disabled={draft.kind !== 'every'} onChange={e => onChange({ ...typed, unit: e.target.value as PaceUnit })} aria-label="Unit" className={field}>
          {PACE_UNITS.map(unit => (
            <option key={unit} value={unit}>
              {Number(typed.count) === 1 ? UNIT_WORDS[unit] : `${UNIT_WORDS[unit]}s`}
            </option>
          ))}
        </select>
        {timed && (
          <>
            <span>at</span>
            <input
              type="time"
              value={typed.at}
              disabled={draft.kind !== 'every'}
              // A time left half typed has no text; the browser says so on the field itself.
              onChange={e => onChange({ kind: 'every', count: typed.count, unit: typed.unit, at: e.target.value, ...(e.target.validity.badInput ? { atHalfTyped: true as const } : {}) })}
              aria-label="Time of day"
              className={field}
            />
            <span className="text-xs text-muted-foreground">optional, this machine's time{typed.unit === 'mo' ? '; a month counts as 30 days' : ''}</span>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Counted from its last start, on any machine that shares this repository.</p>
    </fieldset>
  )
}

/** A row's one line: when the command runs, how many agents at once when that is worth saying, how far its runs publish, and what the scheduler last decided for it; a decision that started a run opens that agent. */
function Summary({ host, project, scheduled }: { host: ReturnType<typeof useModuleHost>; project: ModuleProject; scheduled: SchedulerCommand }) {
  const last = decided(scheduled)
  const run = scheduled.decision?.run
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
      <span>{pace(scheduled)}</span>
      {ownPace(scheduled) && (
        <>
          <span aria-hidden>·</span>
          <span className="text-info">your pick</span>
        </>
      )}
      {saysAtOnce(scheduled) && (
        <>
          <span aria-hidden>·</span>
          <span>{atOnceWords(atOnce(scheduled))}</span>
          {scheduled.agents !== undefined && (
            <>
              <span aria-hidden>·</span>
              <span className="text-info">your pick</span>
            </>
          )}
        </>
      )}
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
