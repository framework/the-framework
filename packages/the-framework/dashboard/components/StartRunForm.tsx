import { useRef, useState } from 'react'
import type { ProjectSummary } from '../../dist/index.js'
import { DEFAULT_HANDOFF, handoffReaches, runOptionsFromPreferences } from '../../dist/client.js'
import { onAgentReady, onClaudeTrust, onProjects, onRepoAutoMerge } from '../server/projects.telefunc.js'
import { onSystemPromptUser } from '../server/reads.telefunc.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { useConnectionProfiles } from '../lib/profiles.js'
import { useSelectedRemoteDeviceId } from '../lib/remote-target.js'
import { useStartRun } from '../lib/use-start-run.js'
import { useLoaded } from '../lib/use-async.js'
import { Composer, type ComposerHandle } from './Composer.js'
import { ContextMenu } from './ContextMenu.js'
import { SystemPromptDisclosure } from './SystemPromptDisclosure.js'

// Start a run in the selected project (#405): the one write that goes through the daemon's own
// `startRun` (with its one-run-per-project busy guard), posted over Telefunc. The editor + control
// row are the shared Composer (#721); this form owns the submit (sendStart with the collected
// Global options), the system-prompt preview, and the Context selector. Shown when no run is active;
// a `busy` result means one already is.
export function StartRunForm({
  projectId,
  onRunStarted,
  files,
  context,
  addContext,
  removeContext,
  toggleContext,
}: {
  projectId: string
  /** `runsOn` names the device a remote run executes on (#1067), for the "runs on <device>" marker. */
  onRunStarted?: ((intent: string, runId?: string, runsOn?: string) => void) | undefined
  /** The project's files for the `#` picker (#504), owned by the shell. */
  files: string[]
  /** The run Context set, shared with the right-rail file tree (#492) — owned by the shell. */
  context: Set<string>
  /** Add a path to the Context (from an `@`/`#` mention). */
  addContext: (path: string) => void
  /** Drop a path from the Context when its `@`/`#` chip leaves the editor (#948). */
  removeContext: (path: string) => void
  /** Toggle a path in the Context (from a repo checkbox). */
  toggleContext: (path: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const { busy, error, reset, start } = useStartRun()
  const composerRef = useRef<ComposerHandle>(null)

  // The Global options persist daemon-side (#410).
  const preferences = usePreferences()
  const vanilla = preferences.vanilla ?? false
  const transparent = preferences.transparent ?? false // #625: the master off-switch (raw Claude Code)

  // Context selector (#439/#314): the agent can reach every registered repo, so ticking a subset
  // narrows its focus — the picked paths become one `Context:` line in the system prompt.
  const projects = useLoaded<ProjectSummary[]>(onProjects, [], [])
  // The repo's own SYSTEM.md (#872): composition takes it as `user`, but reading it is
  // Node-bound, so without this read the "entire system prompt" preview under-reported.
  const userSystemPrompt = useLoaded<string | null>(() => onSystemPromptUser(projectId), null, [projectId])

  // The Context set mixes whole repos (registered project paths) and individual files (relative
  // paths). Split out the files so they can be shown + removed, and count each kind separately.
  const projectPaths = new Set(projects.map(p => p.path))
  const contextFiles = [...context].filter(path => !projectPaths.has(path))
  // The current project is already the run's workspace, so it isn't offered as a focus target
  // (#665) — only the other registered repos are, and only those count toward the header.
  const otherProjects = projects.filter(p => p.id !== projectId)
  const selectedRepos = otherProjects.filter(p => context.has(p.path)).length
  const contextSummary = [
    selectedRepos > 0 ? `${selectedRepos} project${selectedRepos > 1 ? 's' : ''}` : null,
    contextFiles.length > 0 ? `${contextFiles.length} file${contextFiles.length > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // The device this run targets (#1067), if one is picked in the "Run on" gear. Its token is a
  // per-browser secret, so it rides the run as memory-only `options.remote` and is never persisted.
  const profiles = useConnectionProfiles()
  const selectedDeviceId = useSelectedRemoteDeviceId()
  const remoteDevice = selectedDeviceId ? profiles.find(p => p.id === selectedDeviceId) : undefined

  // The options this run will start with: the daemon's own mapping (#858), read once, so the
  // submit and the system-prompt preview below cannot disagree with the run they describe. A picked
  // device adds the relay target (#1067); absent, this is byte-identical to a local start.
  const options = {
    ...runOptionsFromPreferences(preferences, [...context]),
    ...(remoteDevice ? { remote: { url: remoteDevice.url, token: remoteDevice.token, label: remoteDevice.label } } : {}),
  }

  // A web run on a project Claude Code has not been trusted in dies on the CLI's interactive
  // trust dialog (#1314), so say so BEFORE the run is spent, with the one-time fix (#1318).
  // Read only when web is the target; `known: false` (config unreadable) shows nothing rather
  // than crying wolf, and the run's own failure advice remains the fallback.
  const web = options.target === 'web' && !remoteDevice
  const trust = useLoaded<Awaited<ReturnType<typeof onClaudeTrust>>>(
    () => (web ? onClaudeTrust(projectId) : Promise.resolve(null)),
    null,
    [projectId, web],
  )
  const untrusted = web && trust !== null && trust.known && !trust.trusted

  // Can the picked agent's CLI start a run at all (#1326)? An `actions` run needs nothing local,
  // and a remote run executes on its own device, so neither is probed here. Re-read when the agent
  // changes, since the answer is per CLI: `claude` being logged in says nothing about `codex`.
  // An armed PR/merge rung adds the `gh` half (#1419): the handoff publishes through the GitHub
  // CLI, so a missing or logged-out `gh` is said now, not hours later as a silently unopened PR.
  const localAgent = options.target !== 'actions' && !remoteDevice
  const agent = options.agent ?? 'claude'
  const publishArmed = localAgent && handoffReaches(options.handoff ?? DEFAULT_HANDOFF, 'pr')
  const ready = useLoaded<Awaited<ReturnType<typeof onAgentReady>> | null>(
    () => (localAgent ? onAgentReady(agent, publishArmed) : Promise.resolve(null)),
    null,
    [agent, localAgent, publishArmed],
  )

  // An armed merge on a repo with GitHub auto-merge disabled silently degrades to an immediate
  // direct merge — the PR lands before CI has run (#1417/#1406). Warn with the fix BEFORE the
  // session is spent, the way #1318 warns about trust. Read only while the merge rung is armed;
  // a remote run merges on its own device, so it is not probed here.
  const mergeArmed = options.handoff === 'merge' && !remoteDevice
  const repoAutoMerge = useLoaded<Awaited<ReturnType<typeof onRepoAutoMerge>>>(
    () => (mergeArmed ? onRepoAutoMerge(projectId) : Promise.resolve(null)),
    null,
    [projectId, mergeArmed],
  )
  const autoMergeDisabled = mergeArmed && repoAutoMerge !== null && repoAutoMerge.known && !repoAutoMerge.allowed

  const submit = async (text: string, submitKind: 'build' | 'prompt') => {
    if (busy) return
    setNote('Starting…')
    // A preset run (`submitKind === 'prompt'`) is fired work, not a conversation: it runs
    // unattended (#1279), ending at settle with its armed handoff firing, exactly as the same
    // routine does when the auto-PM sweep starts it. A typed prompt keeps the stay-open chat.
    const result = await start(projectId, text, submitKind, submitKind === 'prompt' ? { ...options, unattended: true } : options)
    setNote(null)
    if (result) {
      // Show the run in the Runs rail immediately (#405): the spawned process writes its run.json
      // a beat later, so seed an optimistic row with the typed prompt until the real meta takes over.
      // A remote run (#1067) carries the device label so the view can mark where it executes.
      onRunStarted?.(text, result.runId, remoteDevice?.label) // select the run we just started (#761)
      composerRef.current?.clear()
      setPrompt('')
    }
  }

  // The Enhanced System Prompt dropdown (#863) rides the start of the "In play" row (#1046).
  const systemPromptEl = (
    <SystemPromptDisclosure
      prompt={prompt}
      disabled={vanilla}
      onDisabledChange={value => updatePreferences({ vanilla: value })}
      transparent={transparent}
      onTransparentChange={value => updatePreferences({ transparent: value })}
      // Read off the options this form will really send, so the preview cannot claim a
      // smaller prompt than the run gets (#863 asks for the entire one). The browser
      // section is Claude-only, and that rule lives in the mapping rather than here.
      browser={options.browser ?? false}
      context={[...context]}
      user={userSystemPrompt}
      busy={busy}
    />
  )

  return (
    <form onSubmit={e => e.preventDefault()} className="p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start a session</div>
      <Composer
        ref={composerRef}
        files={files}
        addContext={addContext}
        removeContext={removeContext}
        onSubmit={submit}
        onPromptChange={value => {
          setPrompt(value)
          if (!value.trim() && note) setNote(null)
          // Editing after a failed start: the red error described the old attempt, drop it (#948).
          if (error) reset()
        }}
        onPreset={(label, replaced) => {
          reset()
          setNote(
            replaced
              ? `${label} preset loaded over your draft — undo (⌘Z) brings the draft back`
              : `${label} preset loaded — review or edit, then Start`,
          )
        }}
        busy={busy}
        submitLabel="Start session"
        submitBusyLabel="Starting…"
        contextControl={
          <ContextMenu
            otherProjects={otherProjects}
            context={context}
            contextFiles={contextFiles}
            summary={contextSummary}
            busy={busy}
            onToggle={toggleContext}
          />
        }
        resolvedRowStart={systemPromptEl}
      />

      {/* Feedback right where the action is (#948): the error used to render below the (possibly
          expanded, tall) Context disclosure, past the fold from the Start button that caused it. */}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      {note && !error && <p role="status" className="mt-2 text-xs text-muted-foreground">{note}</p>}
      {/* The doomed-web-run warning (#1318): before the start, not after three dead runs (#1314). */}
      {untrusted && (
        <p role="alert" className="mt-2 text-xs text-warning">
          Claude Code has not been trusted in this project, so a Claude web run cannot start a cloud
          session. One-time fix: run <code className="font-mono">claude</code> in{' '}
          <code className="font-mono">{trust!.root}</code> once and accept the trust prompt, then start
          the session — future runs inherit it.
        </p>
      )}
      {/* The agent cannot start at all (#1326): said here, before the Start spends a branch and a
          worktree on a session that dies before it exists (#1323). Each line names its own fix. */}
      {ready?.problems.map(problem => (
        <p key={problem} role="alert" className="mt-2 text-xs text-danger">
          {problem}
        </p>
      ))}
      {ready?.warnings.map(warning => (
        <p key={warning} role="alert" className="mt-2 text-xs text-warning">
          {warning}
        </p>
      ))}
      {/* The Haiku warning (#1439): never block, always teach. Haiku skips the session-finish
          protocol so reliably (0/5 in the #1334 tier test, every stronger tier 1/1) that a
          merge-armed run ends withheld as a draft PR — say so before the session is spent. */}
      {options.model === 'haiku' && (
        <p role="alert" className="mt-2 text-xs text-warning">
          Haiku consistently skips the session-finish protocol, so a publishing run ends as an
          unmerged draft PR and needs hand-holding. Pick Fable for real work — Haiku is best kept
          for throwaway experiments.
        </p>
      )}
      {/* The armed merge will not wait for CI (#1417): this repo refuses GitHub auto-merge, so
          the merge degrades to an immediate direct merge (#1216/#1406). Never a block — the
          direct merge may be exactly what a solo prototyper wants — but say so, with the fix. */}
      {autoMergeDisabled && (
        <p role="alert" className="mt-2 text-xs text-warning">
          This repo has GitHub auto-merge disabled, so an auto-merged session lands its PR
          immediately — CI is not awaited. To let checks gate the merge, enable{' '}
          <span className="font-medium">Allow auto-merge</span> in the repo settings and mark a
          check (e.g. <code className="font-mono">build</code>) as required.
        </p>
      )}
    </form>
  )
}
