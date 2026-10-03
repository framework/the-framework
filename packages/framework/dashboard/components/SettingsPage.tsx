import { useState, type ReactNode } from 'react'
import { DEFAULT_AT_ONCE, DRIVERS, DRIVER_LABELS, MAX_SPEND_OFFSET, isDriverName, type SubagentRunner, type SubagentSettings, PUBLISH_LABELS, isPublishPick, offeredPublishPicks, type PublishPick } from '../../src/client.js'
import { driverOptions, useModels } from '../lib/models.js'
import { NO_MODEL_PINNED } from '../lib/agent-settings.js'
import type { DriverOption } from './DriverModelMenu.js'
import { useQuota } from '../lib/quota.js'
import { useSpendOffset } from './Quota.js'
import { onSchedulers } from '../rpc/reads.js'
import { sendSchedulePublish, sendScheduleSwitch } from '../rpc/projects.js'
import { onSubagentSettings, sendSubagentSettings, type SubagentSettingsView } from '../rpc/subagents.js'
import { usePolled } from '../lib/use-async.js'
import type { ProjectScheduler, SchedulerCommand } from '../../src/index.js'
import { useDetectedEditors } from '../lib/editors.js'
import { usePreferences, updatePreferences, themePreference, type ThemePreference } from '../lib/preferences.js'
import { useNotificationPermission } from '../lib/notification-permission.js'
import { OnboardingChecklist } from './OnboardingChecklist.js'
import { BridgeSettings } from './BridgeSettings.js'
import { BridgeBrowserSettings } from './BridgeBrowserSettings.js'
import { DevicesSettings } from './DevicesSettings.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Checkbox } from './ui/checkbox.js'
import { ScrollArea } from './ui/scroll-area.js'
import { cn } from '../lib/utils.js'

// The settings page (#958): every setting in one place, and the Onboarding checklist.
//
// Until now settings were spread across the header's menus — the composer's gear, the bell, the
// theme toggle — which is fine while you are running something and useless when you are looking
// for one. This is the page the Overview's "you can resume the onboarding on the settings page"
// points at, so the checklist lives here too and is not dismissible.
//
// Everything here writes your own settings, the same on every project: what is a project's own
// (how a run is started) lives in that project's hooks file, not here. The Automation section's
// schedule switches and publish picks are this machine's too, written through each project's
// `switch` and `publish` hooks.

export function SettingsPage({
  onAgentStarted,
  onSelectProject,
}: {
  /** Where a session the onboarding checklist starts lands (#1169): on that session. */
  onAgentStarted: (projectId: string, intent: string, agentId: string) => void
  /** Where the checklist's "Configure first, then run" lands (#1507): that project's launcher. */
  onSelectProject: (id: string) => void
  onDone?: () => void
}) {
  const preferences = usePreferences()
  const editors = useDetectedEditors()
  const theme = themePreference(preferences)
  // The start menu's own list (#1874), so Settings offers exactly the picks the menu does.
  const drivers = driverOptions(useModels())
  const driver = preferences.driver ?? DRIVERS[0]
  const model = preferences.model ?? ''
  // One shared table with the launcher (#958), rules already applied.
  // A notification toggle is a preference; whether it can deliver is the browser's permission
  // (#948). Both are shown, the same way the bell does, so the row cannot promise delivery that
  // will not happen.
  const permission = useNotificationPermission()
  const browserBlocked = permission === 'denied'

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Your defaults, everywhere.
          </p>
        </div>

        <OnboardingChecklist onAgentStarted={onAgentStarted} onSelectProject={onSelectProject} />

        <Section title="Appearance">
          <SelectRow
            label="Theme"
            description="Follow the system, or pin light or dark."
            value={theme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={value => updatePreferences({ theme: value as ThemePreference })}
          />
          <SelectRow
            label="Editor"
            description="Which editor “Open in editor” launches."
            value={preferences.editor ?? ''}
            options={[
              { value: '', label: 'Auto-detect' },
              ...editors.map(e => ({ value: e.bin, label: e.label })),
            ]}
            onChange={value => updatePreferences({ editor: value })}
          />
        </Section>

        <Section title="Agent">
          <SelectRow
            label="Agent"
            description="Which coding agent runs the work."
            value={driver}
            options={drivers}
            // A model is always one agent's own (the start menu's rule), so a new agent starts unpinned.
            onChange={value => updatePreferences({ driver: value, model: '' })}
          />
          <SelectRow
            label="Model"
            description="The models the agent lists. Its own default when none is picked."
            value={model}
            options={modelOptions(drivers.find(d => d.value === driver), model)}
            onChange={value => updatePreferences({ model: value })}
          />
          <ToggleRow
            label="Post-merge cleanup"
            description="The launcher's box, ticked by default: once a run ends done with a pull request, a fresh agent runs /post-merge-cleanup on its branch before it merges. In projects with that command."
            checked={preferences.postMergeCleanup ?? false}
            onChange={next => updatePreferences({ postMergeCleanup: next })}
          />
        </Section>

        <SubagentsSection drivers={drivers} />

        {/* A saved device is the other place a session can run on. */}
        <DevicesSettings />

        <Section title="Notifications">
          <ToggleRow
            label="Browser"
            description={
              browserBlocked
                ? 'Blocked in your browser settings'
                : 'Desktop notifications while the dashboard is open.'
            }
            checked={(preferences.notifyBrowser ?? true) && !browserBlocked}
            disabled={browserBlocked}
            onChange={next => updatePreferences({ notifyBrowser: next })}
          />
          <ToggleRow
            label="Human Queue"
            description="An agent awaiting your answer, or a PR ready to review."
            checked={preferences.notifyHumanIntervention ?? true}
            onChange={next => updatePreferences({ notifyHumanIntervention: next })}
          />
          <ToggleRow
            label="New activity"
            description="Also ping when an agent starts or finishes."
            checked={preferences.notifyNewActivity ?? false}
            onChange={next => updatePreferences({ notifyNewActivity: next })}
          />
        </Section>

        <SpendOffsetSection />

        <Section
          title="Claude web"
          description="A Claude web agent hands off and ends, so the questions its session asks never reach this dashboard. The browser bridge carries them back and types your answers into the session."
        >
          <ToggleRow
            label="Browser bridge"
            description="Carry claude.ai questions into this dashboard and type your answers back. A browser signed in to claude.ai does the work, through the bridge extension."
            checked={preferences.bridge ?? false}
            onChange={next => updatePreferences({ bridge: next })}
          />
          {(preferences.bridge ?? false) && (
            // One feature, one real choice (#1332): which browser drives claude.ai. Two toggles
            // named "Browser bridge" and "Bridge browser" read as anagrams; a choice under the
            // switch reads as what it is. The preference stays the boolean `bridgeBrowser`.
            <BridgeBrowserChoice
              daemonBrowser={preferences.bridgeBrowser ?? false}
              onChange={next => updatePreferences({ bridgeBrowser: next })}
            />
          )}
        </Section>
      </div>
    </ScrollArea>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">{children}</div>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  description,
  control,
  dimmed = false,
}: {
  label: string
  description: string
  control: ReactNode
  /** A row the rules turned off: greyed, but still shown with its reason. */
  dimmed?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className={cn('text-sm', dimmed && 'text-muted-foreground')}>{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/**
 * Which browser does the bridge's work (#1332): one the daemon runs — recommended, since web runs
 * then work with the user's own Chrome closed — or the user's own Chrome with the extension set up
 * by hand. Each option carries what it needs right under it: the daemon's browser its status and
 * window controls, the user's Chrome the token to paste. Both can technically serve at once
 * (answers are claimed on read), but a person decides one, so it is presented as one.
 */
function BridgeBrowserChoice({ daemonBrowser, onChange }: { daemonBrowser: boolean; onChange: (daemonBrowser: boolean) => void }) {
  const option = (value: boolean, label: string, description: string, body: ReactNode) => (
    <label className={cn('flex cursor-pointer gap-3 rounded-md border p-3', daemonBrowser === value ? 'border-primary/60 bg-muted/20' : 'border-border')}>
      <input
        type="radio"
        name="bridge-browser"
        className="mt-1 shrink-0"
        checked={daemonBrowser === value}
        onChange={() => onChange(value)}
        aria-label={label}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
        {daemonBrowser === value && body}
      </span>
    </label>
  )
  return (
    <fieldset className="mt-3 space-y-2">
      <legend className="text-sm font-medium">Which browser does the work?</legend>
      {option(
        true,
        'A browser the daemon runs — recommended',
        'Chrome for Testing, downloaded once, signed in once, kept minimized. Web runs work with your own Chrome closed.',
        <BridgeBrowserSettings enabled />,
      )}
      {option(
        false,
        'Your own Chrome',
        'Install the extension, open its options and paste the token. Web runs need your Chrome open.',
        <BridgeSettings enabled onChange={() => {}} />,
      )}
    </fieldset>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
  /** A capability the daemon or browser withholds, e.g. notifications the browser has blocked. */
  disabled?: boolean
}) {
  return (
    <Row
      label={label}
      description={description}
      dimmed={disabled}
      control={
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={next => onChange(next === true)}
          aria-label={label}
        />
      }
    />
  )
}

/**
 * The Model row's choices: the agent's own default first (the one pick the start menu has no entry
 * for, since a menu entry is always a real model), then the models the agent listed. A saved model
 * the list does not hold is kept, by its id, since that id is still what a start is given; a list
 * not answered yet, or that could not be had, says why in a line that cannot be picked.
 */
function modelOptions(driver: DriverOption | undefined, model: string): SelectOption[] {
  const listed = driver?.models ?? []
  return [
    { value: '', label: NO_MODEL_PINNED },
    ...listed,
    ...(model && !listed.some(m => m.value === model) ? [{ value: model, label: model }] : []),
    ...(listed.length === 0 && driver?.modelsNote ? [{ value: driver.modelsNote, label: driver.modelsNote, disabled: true }] : []),
  ]
}

interface SelectOption {
  value: string
  label: string
  /** A line in the list that says something rather than being a choice. */
  disabled?: boolean
}

/**
 * One setting picked from a list.
 *
 * A row with nothing to pick renders nothing at all (#1172). An empty `<select>` is a control that
 * cannot be operated — it reads as broken rather than as "no choices here", which is exactly the
 * paper cut this guard exists for. Every list on this page has a fixed first entry today ("Auto-detect",
 * the agent's own default), so nothing hits it; it is here because the next list will be added
 * without thinking about the empty case.
 */
function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string
  description: string
  value: string
  options: SelectOption[]
  onChange: (next: string) => void
}) {
  if (options.length === 0) return null
  return (
    <Row
      label={label}
      description={description}
      control={
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={label}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      }
    />
  )
}

/**
 * The spend offset as a number (#960): the same value the usage panel's slider moves, read off the
 * projects' schedulers and written through their `offset` hooks. Bounded to the same
 * ±MAX_SPEND_OFFSET the slider uses; the value shown is the one in force, to one decimal.
 */
function SpendOffsetSection() {
  const view = useQuota()
  const [offset, setOffset, error] = useSpendOffset(view?.boundary?.limit.offset)
  return (
    <Section title="Automation">
      <NumberRow
        label="Spend offset"
        description={`How far each project's scheduler may start work past the quota boundary, in percentage points (max ${MAX_SPEND_OFFSET}). Negative holds it back; positive lets it borrow from the days ahead. Set through each project's offset hook.`}
        value={Math.round(offset * 10) / 10}
        min={-MAX_SPEND_OFFSET}
        max={MAX_SPEND_OFFSET}
        onChange={setOffset}
      />
      {error && (
        <p role="alert" className="text-xs text-danger">
          The offset was not saved: {error}
        </p>
      )}
      <ScheduleSwitchRows />
    </Section>
  )
}

const NO_SUBAGENT_SETTINGS: SubagentSettingsView = { settings: {}, hooked: 0 }

/** The choice that leaves a level unset: the main agent's own coding agent and model. */
const SAME_AS_MAIN = ''

/**
 * A level's choices (#1902): the main agent's own first, then every coding agent, by its own default
 * and by each model it lists. A choice is one coding agent and one model, `<driver>` or
 * `<driver> <model>`, since a model is always one agent's own. A saved model the list does not
 * hold is kept, by its id.
 */
export function subagentRunnerChoices(drivers: readonly DriverOption[], saved: SubagentRunner | undefined): SelectOption[] {
  const options: SelectOption[] = [{ value: SAME_AS_MAIN, label: 'Same as the main agent' }]
  for (const driver of drivers) {
    options.push({ value: driver.value, label: `${driver.label} · ${NO_MODEL_PINNED}` })
    for (const model of driver.models) options.push({ value: `${driver.value} ${model.value}`, label: `${driver.label} · ${model.label}` })
  }
  const value = subagentRunnerValue(saved)
  if (!options.some(o => o.value === value) && saved) options.push({ value, label: `${DRIVER_LABELS[saved.driver]} · ${saved.model ?? NO_MODEL_PINNED}` })
  return options
}

export function subagentRunnerValue(runner: SubagentRunner | undefined): string {
  if (!runner) return SAME_AS_MAIN
  return runner.model !== undefined ? `${runner.driver} ${runner.model}` : runner.driver
}

export function subagentRunnerOf(value: string): SubagentRunner | undefined {
  const [driver, ...model] = value.split(' ')
  if (!driver || !isDriverName(driver)) return undefined
  return model.length > 0 ? { driver, model: model.join(' ') } : { driver }
}

/**
 * Subagents (#1902): which coding agent and model a main agent's subagents run on, by how hard the
 * main agent says their task is, and how many of one main agent's subagents run at once. The same
 * on every project: read off the projects' orchestration settings, written through each project's
 * `subagents` hook, whole.
 */
function SubagentsSection({ drivers }: { drivers: DriverOption[] }) {
  const { value: view, reload } = usePolled(onSubagentSettings, NO_SUBAGENT_SETTINGS, 10000, [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const { settings } = view
  const save = (next: SubagentSettings): void => {
    setSaving(true)
    setError(undefined)
    void sendSubagentSettings(next).then(result => {
      setSaving(false)
      if (!result.ok) setError(result.error)
      reload()
    })
  }
  const level = (key: 'simple' | 'hard') => (value: string) => {
    const { [key]: _old, ...rest } = settings
    const runner = subagentRunnerOf(value)
    save(runner ? { ...rest, [key]: runner } : rest)
  }
  const atOnce = settings.atOnce ?? DEFAULT_AT_ONCE
  return (
    <Section title="Subagents" description="The models a main agent's subagents run on, by how hard the main agent says each task is. The same on every project, on this machine.">
      {view.hooked === 0 && (
        <p className="text-xs text-muted-foreground">
          No project has a subagents line in .the-framework/hooks.yml yet: run <code>npx orchestration init</code> in a project.
        </p>
      )}
      <SelectRow label="Simple tasks" description="A task the main agent marks simple." value={subagentRunnerValue(settings.simple)} options={subagentRunnerChoices(drivers, settings.simple)} onChange={level('simple')} />
      <SelectRow label="Hard tasks" description="A task the main agent marks hard." value={subagentRunnerValue(settings.hard)} options={subagentRunnerChoices(drivers, settings.hard)} onChange={level('hard')} />
      <SelectRow
        label="At once"
        description="How many of one main agent's subagents run at the same time. It starts the next when one ends."
        value={String(atOnce)}
        options={Array.from({ length: Math.max(8, atOnce) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
        onChange={value => save({ ...settings, atOnce: Number(value) })}
      />
      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          The subagent settings were not saved: {error}
        </p>
      )}
    </Section>
  )
}

const NO_SCHEDULERS: ProjectScheduler[] = []

/**
 * Run on a schedule: one row per command of each project's schedule (`agent-schedule.md`), as the
 * project's scheduler last read it, with a switch and a publish menu. On means the scheduler
 * starts the command on this machine when it is due; the menu says how far its runs publish on
 * this machine: what the schedule line says, or the person's pick in its place. Both are this
 * machine's, written through the project's `switch` and `publish` hooks, and what the schedule
 * line says is the default. A project whose scheduler has not ticked yet lists nothing.
 */
function ScheduleSwitchRows() {
  const { value: rows, reload } = usePolled(onSchedulers, NO_SCHEDULERS, 5000, [])
  const [saving, setSaving] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const save = (projectId: string, command: string, what: string, send: Promise<{ ok: true } | { ok: false; error: string }>): void => {
    const key = `${projectId}/${command}`
    setSaving(key)
    setError(undefined)
    void send.then(result => {
      setSaving(current => (current === key ? undefined : current))
      if (!result.ok) setError(`The ${what} was not saved: /${command}: ${result.error}`)
      reload()
    })
  }
  return (
    <>
      {rows.flatMap(row =>
        row.commands.map(command => {
          const label = `Run /${command.command} on a schedule`
          const busy = saving === `${row.projectId}/${command.command}`
          return (
            <Row
              key={`${row.projectId}/${command.command}`}
              label={label}
              description={`${row.projectName} · ${pace(command)} · ${publishes(command)}. On this machine only; agent-schedule.md sets the defaults.`}
              dimmed={busy}
              control={
                <div className="flex items-center gap-3">
                  <select
                    value={command.publishPick ?? ''}
                    disabled={busy}
                    onChange={e => {
                      const pick = e.target.value
                      if (pick === '' || isPublishPick(pick)) save(row.projectId, command.command, 'publish pick', sendSchedulePublish(row.projectId, command.command, pick === '' ? null : pick))
                    }}
                    aria-label={`What /${command.command} publishes`}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  >
                    <option value="">As the file says ({PUBLISH_LABELS[command.publish ?? 'nothing']})</option>
                    {publishChoices(row.gitHost, command.publishPick).map(pick => (
                      <option key={pick} value={pick}>
                        {PUBLISH_LABELS[pick]}
                      </option>
                    ))}
                  </select>
                  <Checkbox
                    checked={command.on}
                    disabled={busy}
                    onCheckedChange={next => save(row.projectId, command.command, 'switch', sendScheduleSwitch(row.projectId, command.command, next === true))}
                    aria-label={label}
                  />
                </div>
              }
            />
          )
        }),
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </>
  )
}

/** The picks a scheduled command's publish menu lists after "As the file says": the ones its project is offered, and the pick already saved when the project is no longer offered it. */
export function publishChoices(gitHost: boolean, saved: PublishPick | undefined): readonly PublishPick[] {
  const offered = offeredPublishPicks(gitHost)
  return saved !== undefined && !offered.includes(saved) ? [...offered, saved] : offered
}

/** How often a scheduled command runs, in words: its interval, its check, or both. */
export function pace(command: SchedulerCommand): string {
  if (command.every && command.when) return `every ${command.every} at most, when its check finds work`
  if (command.every) return `every ${command.every}`
  return 'when its check finds work'
}

/** How far a scheduled command's runs publish on this machine, in words: the person's pick here, else what its schedule line says, nothing when it says none. */
export function publishes(command: SchedulerCommand): string {
  const level = command.publishPick ?? command.publish
  if (level === 'branch') return 'publishes its branch'
  if (level === 'pr') return 'opens a pull request'
  if (level === 'merge') return 'opens a pull request that merges on green'
  return 'publishes nothing'
}

function NumberRow({
  label,
  description,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  description: string
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <Row
      label={label}
      description={description}
      control={
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          // Clamped here as well as on the input: `min`/`max` only constrain the spinner, so a typed
          // value still has to be held to the slider's range (#960).
          onChange={e => onChange(Math.min(Math.max(Math.round(Number(e.target.value) || 0), min), max))}
          aria-label={label}
          className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      }
    />
  )
}
