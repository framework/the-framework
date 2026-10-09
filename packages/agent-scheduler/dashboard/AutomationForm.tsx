import { useRef, useState } from 'react'
import { Button, cn, useModuleHost, type ModuleProject } from '@openagt/dashboard/module'
import { MAX_COUNT, PACE_UNITS, type PaceUnit } from '../src/pace.js'
import { UNIT_WORDS } from './schedulers.js'
import { EMPTY_DRAFT, addArgs, draftProblem, draftSentence, editArgs, editedWords, isUntouched, keptWhereHint, paceHint, savedFile, savedWords, saysTheSame, showsChangeWhen, showsWhen, triedLine, whereHint, type AutomationDraft, type OpenedAutomation, type TriedLine } from './automation-form.js'

// The automation form of the Automations page: a person's own prompt, saved as a command of the
// project with a row like any skill's. A name, what the agent is told, and when it runs: on a
// pace, by a shell line that prints what is new, or both. "Try it" runs the shell line once in the
// project and shows what it printed and whether an agent would start; nothing is saved and nothing
// starts.
//
// Opened by "New automation" it is empty, and saving (`agent-scheduler add`) is the person's choice
// of two: shared with the project, a skill file of theirs to commit, whose row cannot start before
// it is where an agent's checkout starts; or only on this machine, where nothing is to commit and
// the row can start at once. Opened from a row, by "Edit prompt", it holds that automation as its
// file says it, and saving (`agent-scheduler edit`) writes the file anew where it is: the name and
// who gets it are fixed. Either way the form says, once saved, where the file is and what is left
// for the person to do.

const field = 'rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50'
const label = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function AutomationForm({
  project,
  ticking,
  opened,
  ownPace,
  onClose,
  onSaved,
}: {
  project: ModuleProject
  /** Whether the project's scheduler is running: the row shows what was saved once it has looked. */
  ticking: boolean
  /** The automation the form was opened from, to be saved again under its name; none for a new one. */
  opened?: OpenedAutomation
  /** The pace the row runs at on this machine, as a sentence, when the person picked one here: the pace typed in the form is the file's, and theirs stays in force. */
  ownPace?: string
  onClose: () => void
  onSaved: () => void
}) {
  const host = useModuleHost()
  const from = opened?.draft ?? EMPTY_DRAFT
  const title = opened ? (from.onThisMachine ? from.name : `/${from.name}`) : undefined
  const named = title === undefined ? 'New automation' : `Prompt of ${title}`
  const [draft, setDraft] = useState<AutomationDraft>(from)
  /** The shell line being tried, or what the try of the line as it stands answered: changing the line takes the answer away. */
  const [tried, setTried] = useState<'trying' | TriedLine | undefined>()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<string | undefined>()
  const [saved, setSaved] = useState<{ command: string; file: string; startsFrom: string; onThisMachine: boolean } | undefined>()
  const set = (change: Partial<AutomationDraft>): void => {
    setDraft(current => ({ ...current, ...change }))
    setFailed(undefined)
  }
  const line = draft.when.trim()
  const problem = draftProblem(draft, opened?.file)
  const sentence = draftSentence(draft)
  /** Nothing to save: the form opened from a row still says what the file says. */
  const unchanged = opened !== undefined && saysTheSame(draft, from)

  /** The last try asked for: an answer to an earlier one, come back late, changes nothing. */
  const asked = useRef(0)
  const tryIt = async (): Promise<void> => {
    const mine = ++asked.current
    setTried('trying')
    const answer = await host.runCommand(project.id, ['try', `--when=${line}`]).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }))
    if (asked.current !== mine) return
    setTried(answer.ok ? triedLine(answer.output) : { printed: '', verdict: `The line could not be tried: ${answer.error}`, tone: 'failed' })
  }

  const save = async (): Promise<void> => {
    const args = opened ? editArgs(draft, opened.file) : addArgs(draft)
    if (!args) return
    setSaving(true)
    setFailed(undefined)
    const answer = await host.runCommand(project.id, args).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }))
    setSaving(false)
    if (!answer.ok) return setFailed(`Not saved: ${answer.error}`)
    setSaved({ command: draft.name.trim(), ...savedFile(answer.output) })
    onSaved()
  }

  if (saved) {
    return (
      <div role="group" aria-label={named} className="mt-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
        <p>
          Saved <span className="font-mono">{saved.onThisMachine ? saved.command : `/${saved.command}`}</span> {opened ? 'again, in' : 'as'} <span className="font-mono">{saved.file}</span>.
        </p>
        <p className="mt-2">{opened ? editedWords(saved) : savedWords(saved)}</p>
        <p className="mt-2 text-muted-foreground">{opened ? showsChangeWhen(ticking) : showsWhen(ticking)}</p>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label={named}
      onKeyDown={e => {
        // Escape closes a form that has nothing to lose: nothing typed into a new one, nothing changed in one opened from a row. Any other is closed with Cancel, so a slip of a key loses no prompt.
        if (e.key === 'Escape' && !saving && (opened ? unchanged : isUntouched(draft))) onClose()
      }}
      className="mt-3 rounded-md border border-border bg-muted/40 p-4"
    >
      <fieldset disabled={saving} className="space-y-4">
        <div>
          <label htmlFor="automation-name" className={label}>
            Name
          </label>
          <div className="mt-2 flex items-center gap-1 text-sm">
            {/* A shared one is a command a person can type; one kept on this machine is no command, so it has no slash. */}
            {!draft.onThisMachine && <span className="font-mono text-muted-foreground">/</span>}
            {/* The name is what the row's runs are counted by: it stays, and the keyboard lands on what the agent is told. */}
            <input id="automation-name" type="text" autoFocus={!opened} readOnly={opened !== undefined} value={draft.name} onChange={e => set({ name: e.target.value })} placeholder="answer-comments" className={cn(field, 'w-64 font-mono', opened && 'opacity-60')} />
            {opened && <span className="text-xs text-muted-foreground">the name stays: its past runs are counted by it. For another name, make a new automation and remove this one.</span>}
          </div>
        </div>
        <div>
          <label htmlFor="automation-prompt" className={label}>
            What the agent is told
          </label>
          <textarea id="automation-prompt" rows={4} autoFocus={opened !== undefined} value={draft.prompt} onChange={e => set({ prompt: e.target.value })} placeholder="Answer each new comment below." className={cn(field, 'mt-2 block w-full')} />
        </div>
        <div className="space-y-2">
          <p className={label}>When it runs</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.paced} onChange={e => set({ paced: e.target.checked })} />
              Every
            </label>
            <input type="number" min={1} max={MAX_COUNT} value={draft.count} disabled={!draft.paced} onChange={e => set({ count: e.target.value })} aria-label="How many" className={cn(field, 'w-20')} />
            <select value={draft.unit} disabled={!draft.paced} onChange={e => set({ unit: e.target.value as PaceUnit })} aria-label="Unit" className={field}>
              {PACE_UNITS.map(unit => (
                <option key={unit} value={unit}>
                  {Number(draft.count) === 1 ? UNIT_WORDS[unit] : `${UNIT_WORDS[unit]}s`}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{paceHint(draft)}</span>
          </div>
          {ownPace !== undefined && <p className="text-xs text-info">On this machine the row runs at your own pick, "{ownPace}", and keeps doing so: this pace is the one saved with the automation. The row's Edit changes your pick.</p>}
          <label htmlFor="automation-when" className="block pt-1 text-sm">
            A shell line that prints what is new <span className="text-xs text-muted-foreground">optional</span>
          </label>
          <textarea
            id="automation-when"
            rows={2}
            value={draft.when}
            onChange={e => {
              set({ when: e.target.value })
              // The answer shown, and a try in flight, were for the line as it was.
              asked.current++
              setTried(undefined)
            }}
            placeholder={'gh api "repos/{owner}/{repo}/issues/comments?since=$LAST_RUN" --jq \'[.[] | select(.body | startswith("🤖") | not) | {url: .html_url}]\''}
            spellCheck={false}
            className={cn(field, 'block w-full font-mono text-xs')}
          />
          <p className="text-xs text-muted-foreground">
            Run in this project while the row is on: every minute, or once the pace above has passed. When it prints something, an agent starts and is handed what it printed; when it prints nothing, or an empty list, nothing starts.{' '}
            <span className="font-mono">$LAST_RUN</span> is the time the row last started an agent, or was switched on when that is later.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={line === '' || tried === 'trying'} onClick={() => void tryIt()}>
              {tried === 'trying' ? 'Trying…' : 'Try it'}
            </Button>
            <span className="text-xs text-muted-foreground">Runs the line once, now, on this machine, for 20 seconds at most. Nothing is saved and no agent starts.</span>
          </div>
          {tried !== undefined && tried !== 'trying' && (
            <div role="status" aria-label="What the line answered" className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <p className={cn(tried.tone === 'start' && 'text-success', tried.tone === 'failed' && 'text-danger')}>{tried.verdict}</p>
              {tried.printed !== '' && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{tried.printed}</pre>}
              {tried.lastRun !== undefined && <p className="mt-2 text-xs text-muted-foreground">Tried as if the row had last started a day ago: $LAST_RUN was {tried.lastRun}.</p>}
            </div>
          )}
          {line !== '' && (
            <div>
              <label htmlFor="automation-waits-for" className="block pt-1 text-sm">
                What the line waits for, in plain words <span className="text-xs text-muted-foreground">optional, said on the row</span>
              </label>
              <input id="automation-waits-for" type="text" value={draft.waitsFor} onChange={e => set({ waitsFor: e.target.value })} placeholder="when someone commented" className={cn(field, 'mt-2 block w-full')} />
            </div>
          )}
        </div>
        {!opened && (
          <div className="space-y-2">
            <p className={label}>Who gets it</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="who gets the automation" checked={!draft.onThisMachine} onChange={() => set({ onThisMachine: false })} />
              Shared with the project
              <span className="text-xs text-muted-foreground">a file you commit; everyone who has the project gets the row, switched off</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="who gets the automation" checked={draft.onThisMachine} onChange={() => set({ onThisMachine: true })} />
              Only on this machine
              <span className="text-xs text-muted-foreground">nothing to commit; nobody else gets the row</span>
            </label>
          </div>
        )}
      </fieldset>
      <p className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-sm">{problem ?? (unchanged ? `${sentence}. Nothing is changed yet.` : `${sentence}.`)}</p>
      {failed !== undefined && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {failed}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{opened ? keptWhereHint(opened) : whereHint(draft)}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving || problem !== undefined || unchanged} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
