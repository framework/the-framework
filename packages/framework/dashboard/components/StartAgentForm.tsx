import { useRef, useState } from 'react'
import { usePreferences } from '../lib/preferences.js'
import { useConnectionProfiles } from '../lib/profiles.js'
import { useSelectedRemoteDeviceId } from '../lib/remote-target.js'
import { startPicks, useStartAgent } from '../lib/use-start-agent.js'
import { useProjectLauncher } from '../lib/use-project-launcher.js'
import { Composer, type ComposerHandle } from './Composer.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

// Start a run in the selected project (#405, #1774): the project's commands as buttons, a free-text
// box, and Start, which is the project's own start hook (posted over `sendStart`). The editor +
// control row are the shared Composer (#721); this form owns the submit and the command buttons.
// A project without a start hook cannot start a run from here, and the form says how to add one.
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

  // The commands written to be run by a person, one button each. A click loads the command into
  // the box rather than starting it: a command may take an argument, and a start spends money.
  const buttons = launcher?.commands.filter(command => command.button) ?? []

  return (
    <form onSubmit={e => e.preventDefault()} className="p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start an agent</div>
      {buttons.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {buttons.map(command => {
            const props = {
              type: 'button' as const,
              variant: 'outline' as const,
              size: 'sm' as const,
              disabled: busy,
              onClick: () => loaded(`/${command.name}`, composerRef.current?.load(`/${command.name} `) ?? false),
            }
            if (!command.description)
              return (
                <Button key={command.name} {...props}>
                  /{command.name}
                </Button>
              )
            return (
              <Tooltip key={command.name}>
                <TooltipTrigger render={<Button {...props} />}>/{command.name}</TooltipTrigger>
                <TooltipContent className="max-w-[22rem]">{command.description}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
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
      {noStartHook && (
        <p role="alert" className="mt-2 text-xs text-danger">
          This project has no start hook. Add a <code className="font-mono">start:</code> line to{' '}
          <code className="font-mono">.the-framework/hooks.yml</code>.
        </p>
      )}
    </form>
  )
}
