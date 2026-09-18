import { useState, type ReactNode } from 'react'
import { DRIVERS, DRIVER_LABELS } from '../../src/client.js'
import { useDetectedEditors } from '../lib/editors.js'
import { usePreferences, updatePreferences, themePreference, type ThemePreference } from '../lib/preferences.js'
import { useNotificationPermission } from '../lib/notification-permission.js'
import { useNotifyChannels, reloadNotifyChannels } from '../lib/notify-channels.js'
import { OnboardingChecklist } from './OnboardingChecklist.js'
import { BridgeSettings } from './BridgeSettings.js'
import { BridgeBrowserSettings } from './BridgeBrowserSettings.js'
import { DevicesSettings } from './DevicesSettings.js'
import { DiscordWebhookDialog } from './DiscordDialogs.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Button } from './ui/button.js'
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
// (how a run is started) lives in that project's hooks file, not here.

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
  // One shared table with the launcher (#958), rules already applied.
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
        </Section>

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
