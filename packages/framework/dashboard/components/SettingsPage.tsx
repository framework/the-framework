import { useState, type ReactNode } from 'react'
import type { Preferences } from '../../src/index.js'
import { DRIVERS, DRIVER_LABELS, MAX_SPEND_OFFSET, DEFAULT_SPEND_OFFSET } from '../../src/client.js'
import { useDetectedEditors } from '../lib/editors.js'
import { usePreferences, updatePreferences, themePreference, type ThemePreference } from '../lib/preferences.js'
import { agentOptionRows, type OptionRow } from '../lib/agent-option-rows.js'
import { useNotificationPermission } from '../lib/notification-permission.js'
import { useNotifyChannels, reloadNotifyChannels } from '../lib/notify-channels.js'
import { OnboardingChecklist } from './OnboardingChecklist.js'
import { BridgeSettings } from './BridgeSettings.js'
import { DevicesSettings } from './DevicesSettings.js'
import { DiscordWebhookDialog } from './DiscordDialogs.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Button } from './ui/button.js'
import { Checkbox } from './ui/checkbox.js'
import { ScrollArea } from './ui/scroll-area.js'
import { cn } from '../lib/utils.js'
import { RUN_TARGET_LABELS } from '../lib/agent-settings.js'

// The settings page (#958): every setting in one place, and the Onboarding checklist.
//
// Until now settings were spread across the header's menus — the composer's gear, the bell, the
// theme toggle — which is fine while you are running something and useless when you are looking
// for one. This is the page the Overview's "you can resume the onboarding on the settings page"
// points at, so the checklist lives here too and is not dismissible.
//
// Everything here writes the one writable tier: your own settings (B5). A repo-shaped value belongs
// in that repo's committed `the-framework.yml`, which is edited in the repo, so a settings page can
// only ever mean "the default" — which is what a settings page should mean.

export function SettingsPage({
  onAgentStarted,
  onSelectProject,
}: {
  /** Where a session the onboarding checklist starts lands (#1169): on that session. */
  onAgentStarted: (projectId: string, intent: string, agentId?: string) => void
  /** Where the checklist's "Configure first, then run" lands (#1507): that project's launcher. */
  onSelectProject: (id: string) => void
  onDone?: () => void
}) {
  const preferences = usePreferences()
  const editors = useDetectedEditors()
  const theme = themePreference(preferences)
  // One shared table with the launcher (#958), rules already applied.
  const { main: agentOptions } = agentOptionRows(preferences)
  // A notification toggle is a preference; whether it can deliver is a capability (#948). Both are
  // shown, the same way the bell does, so a row cannot promise delivery that will not happen.
  const permission = useNotificationPermission()
  // Shared with the checklist above and the bell (#1095), so a credential saved in one of the
  // setup dialogs settles every one of them at once rather than each on its own timer.
  const channels = useNotifyChannels()
  const webhookReady = channels === null || channels.discordWebhook
  const browserBlocked = permission === 'denied'
  const [discordWebhookOpen, setDiscordWebhookOpen] = useState(false)

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Your defaults, everywhere. A repo can override them in its own the-framework.yml.
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
            value={preferences.driver ?? DRIVERS[0]}
            options={DRIVERS.map(a => ({ value: a, label: DRIVER_LABELS[a] }))}
            onChange={value => updatePreferences({ driver: value })}
          />
          <TextRow
            label="Model"
            description="Passed through to the agent. Empty uses the agent's own default."
            value={preferences.model ?? ''}
            placeholder="the agent's default"
            onChange={value => updatePreferences({ model: value })}
          />
          <SelectRow
            label="Run on"
            description="Where an agent executes: this machine, a fresh GitHub Actions runner, or a Claude Code cloud session."
            value={preferences.target ?? 'local'}
            options={[
              { value: 'local', label: RUN_TARGET_LABELS.local },
              { value: 'actions', label: RUN_TARGET_LABELS.actions },
              { value: 'web', label: RUN_TARGET_LABELS.web },
            ]}
            onChange={value => updatePreferences({ target: value as 'local' | 'actions' | 'web' })}
          />
        </Section>

        {/* Beside "Run on", since a saved device is the other thing a session can run on. */}
        <DevicesSettings />

        {/* The same table the launcher renders (#958), so a rule cannot hold in one place and
            not the other: Transparent overrides the rest, Eco is inert once the system prompt is
            off, Browser is Claude-only, and the Eco drops need Eco. A row the rules disable is
            shown greyed with its reason rather than hidden, since this is where you come to look. */}
        <Section
          title="Run options"
          description="What a new agent starts with. The launcher's gear shows the same options, and an agent's own action bar can still change its ending."
        >
          {agentOptions.map(row => (
            <OptionToggleRow key={row.key} row={row} />
          ))}
        </Section>

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
            label="Discord"
            description={
              webhookReady
                ? 'Deliver to Discord, so notifications reach you with no dashboard open.'
                : 'Not configured — no webhook is set on the daemon'
            }
            checked={preferences.notifyDiscord ?? false}
            onChange={next => updatePreferences({ notifyDiscord: next })}
            action={
              <Button variant="outline" size="sm" onClick={() => setDiscordWebhookOpen(true)}>
                {channels?.discordWebhook ? 'Webhook' : 'Set up'}
              </Button>
            }
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

        <Section title="Automation">
          <ToggleRow
            label="Auto PM"
            description="Start queued work on its own while there is quota left in the week."
            checked={preferences.autoPm ?? false}
            onChange={next => updatePreferences({ autoPm: next })}
          />
          {/* Bounded to the same ±MAX_SPEND_OFFSET the slider and the sanitizer use (#960). Without
              it a typed 9999 was clamped to 50 on save while the box kept showing 9999.
              An untouched preference shows the real default in force — the half-day cushion
              (#960 Edit), to one decimal — not a 0 the daemon isn't using. A saved value is an
              integer, so the rounding only ever trims the default. */}
          <NumberRow
            label="Spend offset"
            description={`How far unattended work sits from the quota boundary, in percentage points (max ${MAX_SPEND_OFFSET}). Negative holds it back; positive lets it borrow from the days ahead.`}
            value={Math.round((preferences.autoSpendOffset ?? DEFAULT_SPEND_OFFSET) * 10) / 10}
            min={-MAX_SPEND_OFFSET}
            max={MAX_SPEND_OFFSET}
            onChange={value => updatePreferences({ autoSpendOffset: value })}
          />
        </Section>

        <Section
          title="Claude web"
          description="A Claude web agent hands off and ends, so the questions its session asks never reach this dashboard. The browser bridge carries them back."
        >
          <ToggleRow
            label="Browser bridge"
            description="Opens one route on this daemon that a browser extension can reach, guarded by the token below."
            checked={preferences.bridge ?? false}
            onChange={next => updatePreferences({ bridge: next })}
          />
          <BridgeSettings enabled={preferences.bridge ?? false} onChange={next => updatePreferences({ bridge: next })} />
        </Section>
      </div>

      <DiscordWebhookDialog
        open={discordWebhookOpen}
        onOpenChange={setDiscordWebhookOpen}
        channels={channels}
        onSaved={reloadNotifyChannels}
      />
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
 * One row of the shared run-option table (#958).
 *
 * A row the rules disable keeps its place and shows *why* instead of vanishing, because the whole
 * point of this page is to be where you look for a setting. `row.checked` is the effective value,
 * so an option Transparent overrides reads off here exactly as it does in the launcher.
 */
function OptionToggleRow({ row }: { row: OptionRow }) {
  const disabled = row.disabled ?? false
  return (
    <Row
      label={row.label}
      description={(disabled ? row.disabledReason : row.description) ?? row.description ?? ''}
      dimmed={disabled}
      control={
        <Checkbox
          checked={row.checked}
          disabled={disabled}
          onCheckedChange={next => updatePreferences(row.patch(next === true))}
          aria-label={row.label}
        />
      }
    />
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  action,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
  /** A capability the daemon or browser withholds, e.g. notifications the browser has blocked. */
  disabled?: boolean
  /** What supplies the capability the toggle needs (#1095): the Discord rows open their setup dialog. */
  action?: ReactNode
}) {
  return (
    <Row
      label={label}
      description={description}
      dimmed={disabled}
      control={
        <span className="flex items-center gap-2">
          {action}
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={next => onChange(next === true)}
            aria-label={label}
          />
        </span>
      }
    />
  )
}

/**
 * One setting picked from a list.
 *
 * A row with nothing to pick renders nothing at all (#1172). An empty `<select>` is a control that
 * cannot be operated — it reads as broken rather than as "no choices here", which is exactly the
 * paper cut this guard exists for. Every list on this page is static today, so nothing hits it;
 * it is here because the next dynamic one will be added without thinking about the empty case.
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
  options: { value: string; label: string }[]
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
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      }
    />
  )
}

function TextRow({
  label,
  description,
  value,
  placeholder,
  onChange,
}: {
  label: string
  description: string
  value: string
  placeholder?: string
  onChange: (next: string) => void
}) {
  return (
    <Row
      label={label}
      description={description}
      control={
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          aria-label={label}
          className="w-48 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      }
    />
  )
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
          // value still has to be held to the range the sanitizer will enforce anyway (#960).
          onChange={e => onChange(Math.min(Math.max(Math.round(Number(e.target.value) || 0), min), max))}
          aria-label={label}
          className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      }
    />
  )
}
