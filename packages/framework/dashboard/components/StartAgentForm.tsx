import { useRef, useState } from 'react'
import { onProjects, onStartCheck } from '../rpc/projects.js'
import type { ProjectSummary } from '../../src/index.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { useConnectionProfiles } from '../lib/profiles.js'
import { useSelectedRemoteDeviceId } from '../lib/remote-target.js'
import { cleanupPick, offersPostMergeCleanup, startPicks, useStartAgent } from '../lib/use-start-agent.js'
import { useProjectLauncher } from '../lib/use-project-launcher.js'
import { useLoaded } from '../lib/use-async.js'
import { promptWithContext } from '../lib/use-context-set.js'
import { ContextMenu } from './ContextMenu.js'
import { Composer, type ComposerHandle } from './Composer.js'
import { Checkbox } from './ui/checkbox.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

// Start a run in the selected project (#405, #1774): a free-text box, where `/` lists the project's
// commands, and Start, which is the project's own start hook (posted over `sendStart`). The editor +
// control row are the shared Composer (#721); this form owns the submit.
// A project without a start hook cannot start a run from here, and the form says how to add one:
// the scheduler's `init` writes its lines, or a person writes a `start:` line of their own.
// What would stop the run (a coding agent not installed or logged out) is said before the Start,
// from the project's check hook.
// The Context picker (#439/#314) narrows the run's focus to other projects and to files: the
// picked paths ride the prompt as one `Context:` line at its end.
// The "Post-merge cleanup" box, where the project has that command: ticked, the run is followed
// by a fresh agent running the command on its branch before its pull request merges. The box
// writes the same saved setting as Settings → Agent, so its state is every next run's default.
export function StartAgentForm({
  projectId,
  onAgentStarted,
  files,
  context,
  addContext,
  removeContext,
  toggleContext,
}: {
  projectId: string
  /** `runsOn` names the device a remote agent executes on (#1067), for the "runs on <device>" marker. */
  onAgentStarted?: ((intent: string, agentId: string, runsOn?: string) => void) | undefined
  /** The project's files for the `#` picker (#504), owned by the shell. */
  files: string[]
  /** The Context set, shared with the right rail's file tree (#492), owned by the shell. */
  context: Set<string>
  /** Add a path to the Context (from an `@`/`#` mention). */
  addContext: (path: string) => void
  /** Drop a path from the Context when its `@`/`#` chip leaves the editor (#948). */
  removeContext: (path: string) => void
  /** Toggle a path in the Context (a project's checkbox, a file's cross). */
  toggleContext: (path: string) => void
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
  // A device starts the run in its own project, whose commands this launcher does not read.
  const commands = remoteDevice ? [] : (launcher?.commands ?? [])
  const offersCleanup = offersPostMergeCleanup(commands)

  // Re-read when the pick changes: `claude` being logged in says nothing about `codex`. A device
  // runs on its own machine, so this one's CLIs say nothing about it.
  const driver = preferences.driver
  const readiness = useLoaded(remoteDevice ? null : () => onStartCheck(projectId, driver), null, [projectId, driver, remoteDevice === undefined])

  // The Context mixes whole projects (registered paths) and single files (relative paths): the
  // files are listed to be removed, and each kind is counted in the picker's summary. The current
  // project is the run's own checkout, so only the other projects are offered (#665).
  const projects = useLoaded<ProjectSummary[]>(onProjects, [], [])
  const projectPaths = new Set(projects.map(p => p.path))
  const contextFiles = [...context].filter(path => !projectPaths.has(path))
  const otherProjects = projects.filter(p => p.id !== projectId)
  const pickedProjects = otherProjects.filter(p => context.has(p.path)).length
  const contextSummary = [
    pickedProjects > 0 ? `${pickedProjects} project${pickedProjects > 1 ? 's' : ''}` : null,
    contextFiles.length > 0 ? `${contextFiles.length} file${contextFiles.length > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const submit = async (text: string) => {
    if (busy) return
    setNote('Starting…')
    const result = await start(projectId, promptWithContext(text, context), {
      ...startPicks(preferences),
      ...cleanupPick(preferences, commands),
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
        addContext={addContext}
        removeContext={removeContext}
        launcherControls={
          <>
            <ContextMenu
              otherProjects={otherProjects}
              context={context}
              contextFiles={contextFiles}
              summary={contextSummary}
              busy={busy}
              onToggle={toggleContext}
            />
            {offersCleanup && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <label className="flex cursor-pointer items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={preferences.postMergeCleanup ?? false}
                        disabled={busy}
                        onCheckedChange={next => updatePreferences({ postMergeCleanup: next === true })}
                        aria-label="Post-merge cleanup"
                      />
                      Post-merge cleanup
                    </label>
                  }
                />
                <TooltipContent>
                  Once the run ends done with a pull request, a fresh agent runs /post-merge-cleanup on its branch; the merge waits for it.
                </TooltipContent>
              </Tooltip>
            )}
          </>
        }
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
          This project has no start hook. Run <code className="font-mono">npx agent-runner init</code> in the
          project, or add a <code className="font-mono">start:</code> line to{' '}
          <code className="font-mono">.the-framework/hooks.yml</code>.
        </p>
      )}
    </form>
  )
}
