import { useRef, useState } from 'react'
import { onStartCheck } from '../rpc/projects.js'
import { usePreferences } from '../lib/preferences.js'
import { useConnectionProfiles } from '../lib/profiles.js'
import { useSelectedRemoteDeviceId } from '../lib/remote-target.js'
import { startPicks, useStartAgent } from '../lib/use-start-agent.js'
import { useProjectLauncher } from '../lib/use-project-launcher.js'
import { useLoaded } from '../lib/use-async.js'
import { Composer, type ComposerHandle } from './Composer.js'

// Start a run in the selected project (#405, #1774): a free-text box, where `/` lists the project's
// commands, and Start, which is the project's own start hook (posted over `sendStart`). The editor +
// control row are the shared Composer (#721); this form owns the submit.
// A project without a start hook cannot start a run from here, and the form says how to add one:
// the scheduler's `init` writes its lines, or a person writes a `start:` line of their own.
// What would stop the run (a coding agent not installed or logged out) is said before the Start,
// from the project's check hook.
export function StartAgentForm({
  projectId,
  onAgentStarted,
  files,
}: {
  projectId: string
  /** `runsOn` names the device a remote agent executes on (#1067), for the "runs on <device>" marker. */
  onAgentStarted?: ((intent: string, agentId: string, runsOn?: string) => void) | undefined
  /** The project's files for the `#` picker (#504), owned by the shell. */
  files: string[]
}) {
  const [note, setNote] = useState<string | null>(null)
  const { busy, error, reset, start } = useStartAgent()
  const composerRef = useRef<ComposerHandle>(null)
  const preferences = usePreferences()
  const launcher = useProjectLauncher(projectId)

  // The device this run targets (#1067), if one is picked in "Run on". Its token is a per-browser
  // secret, so it rides the start as memory-only `options.remote` and is never persisted. A device
  // runs its own project's start hook, so this project's lack of one does not block it.
  const profiles = useConnectionProfiles()
  const selectedDeviceId = useSelectedRemoteDeviceId()
  const remoteDevice = selectedDeviceId ? profiles.find(p => p.id === selectedDeviceId) : undefined
  const noStartHook = launcher !== null && !launcher.startHook && !remoteDevice

  // Re-read when the pick changes: `claude` being logged in says nothing about `codex`. A device
  // runs on its own machine, so this one's CLIs say nothing about it.
  const driver = preferences.driver
  const readiness = useLoaded(remoteDevice ? null : () => onStartCheck(projectId, driver), null, [projectId, driver, remoteDevice === undefined])

  const submit = async (text: string) => {
    if (busy) return
    setNote('Starting…')
    const result = await start(projectId, text, {
      ...startPicks(preferences),
      ...(remoteDevice ? { remote: { url: remoteDevice.url, token: remoteDevice.token, label: remoteDevice.label } } : {}),
    })
    setNote(null)
    if (result) {
      // Show the run in the Runs rail immediately (#405): its tool writes the run's card a beat
      // later, so seed an optimistic row with the typed prompt until the real one takes over.
      // A remote agent (#1067) carries the device label so the view can mark where it executes.
      onAgentStarted?.(text, result.agentId, remoteDevice?.label) // select the run we just started (#761)
      composerRef.current?.clear()
    }
  }

  const loaded = (label: string, replaced: boolean) => {
    reset()
    setNote(replaced ? `${label} loaded over your draft — undo (⌘Z) brings the draft back` : `${label} loaded — review or edit, then Start`)
  }

  return (
    <form onSubmit={e => e.preventDefault()} className="p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start an agent</div>
      <Composer
        ref={composerRef}
        files={files}
        onSubmit={submit}
        onPromptChange={value => {
          if (!value.trim() && note) setNote(null)
          // Editing after a failed start: the red error described the old attempt, drop it (#948).
          if (error) reset()
        }}
        onPreset={loaded}
        busy={busy}
        canSubmit={!noStartHook}
        submitLabel="Start agent"
        submitBusyLabel="Starting…"
      />

      {/* Feedback right where the action is (#948). */}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      {note && !error && <p role="status" className="mt-2 text-xs text-muted-foreground">{note}</p>}
      {readiness?.problems.map(problem => (
        <p key={problem} role="alert" className="mt-2 text-xs text-danger">
          {problem}
        </p>
      ))}
      {readiness?.warnings.map(warning => (
        <p key={warning} role="alert" className="mt-2 text-xs text-warning">
          {warning}
        </p>
      ))}
      {noStartHook && (
        <p role="alert" className="mt-2 text-xs text-danger">
          This project has no start hook. Run <code className="font-mono">npx agent-scheduler init</code> in the
          project, or add a <code className="font-mono">start:</code> line to{' '}
          <code className="font-mono">.the-framework/hooks.yml</code>.
        </p>
      )}
    </form>
  )
}
