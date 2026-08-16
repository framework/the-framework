import { useEffect, useRef, useState } from 'react'
import type { FrameworkEvent } from '@gemstack/the-framework'
import { sessionInfo } from '@gemstack/the-framework/client'
import { MoreVertical, Github, FolderOpen, Code, Check, Play, ExternalLink, Square, FolderX, Trash2, Copy, GitMerge } from 'lucide-react'
import { onGithubUrl } from '../server/reads.telefunc.js'
import {
  sendOpenInApp,
  sendStop,
  sendMerge,
  sendRemoveWorktree,
  sendDeleteSession,
} from '../server/control.telefunc.js'
import type { EditorInfo } from '../server/preferences.telefunc.js'
import { useLoaded } from '../lib/use-async.js'
import { useAction } from '../lib/use-action.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { useDetectedEditors } from '../lib/editors.js'
import { isRunActive } from '../lib/live-state.js'
import { describeSessionLink } from '../lib/session-link.js'
import { buildResumeCommand } from '../lib/resume-command.js'
import { cn } from '../lib/utils.js'
import { buttonVariants } from './ui/button.js'
import { OptionLabel } from './ui/option-label.js'
import { ConfirmDialog } from './ui/confirm-dialog.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './ui/dropdown-menu.js'

// One ⋮ overflow menu for everything you can DO to a session (#toolbar-menu), instead of a row of
// five-plus icon buttons that came and went with the run's state. It folds in what used to be
// WorkspaceActions (GitHub / folder / editor / Serve), the Stop button, Remove worktree, Open
// session, and Delete. The handoff's Push / Open PR stay visible in the bar — they move the work
// forward, not just open it somewhere. Serve keeps its state (Serve → Open/Stop, or a picker
// submenu in a multi-app repo); the editor keeps its preferred-editor submenu; Delete opens its
// confirm dialog (a menu item cannot also be the dialog's trigger, so the dialog is controlled).
export function SessionActionsMenu({
  projectId,
  runId,
  events,
  label,
  retainedWorktree = false,
  onWorktreeRemoved,
  onDeleted,
}: {
  projectId: string
  runId?: string | null | undefined
  events: FrameworkEvent[]
  label?: string | undefined
  retainedWorktree?: boolean
  onWorktreeRemoved?: (() => void) | undefined
  onDeleted?: (() => void) | undefined
}) {
  const active = isRunActive(events)
  const info = sessionInfo(events)
  const session = describeSessionLink(info)

  // Whether this session still has a checkout of its own. A live run is working in one; a finished
  // run only keeps one while its work has not reached the remote (#737/E5), since that is what
  // teardown waits for before reclaiming it. Without this the folder item promised the session's
  // folder and silently opened the project root instead, because `resolveRunCheckout` falls back
  // there once the worktree is gone.
  const hasOwnFolder = active || retainedWorktree

  // What to put on the clipboard to pick this session back up in a terminal (#1195). `mkdir -p`
  // leads because the directory is usually gone by the time you want it: the CLI finds a session
  // by the cwd it ran in, so the path has to exist again before `--resume` can see it. Recreating
  // it empty is enough to read the conversation back.
  const resumeCommand = buildResumeCommand(info)
  // Flash a confirmation for a beat, the same feedback the CopyButton gives, since a click that
  // only fills the clipboard has nothing else to show for itself.
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(copiedTimer.current), [])
  const copyResume = () => {
    if (!resumeCommand) return
    void navigator.clipboard?.writeText(resumeCommand).then(() => {
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    })
  }
  // keepPrevious: hold the last repo URL while a new project's loads, so the item does not flicker.
  const githubUrl = useLoaded<string | null>(() => onGithubUrl(projectId), null, [projectId], true)

  const editor = usePreferences().editor
  const detectedEditors = useDetectedEditors()
  const editorRows: EditorInfo[] =
    editor && !detectedEditors.some(e => e.bin === editor) ? [...detectedEditors, { bin: editor, label: editor }] : detectedEditors

  const { busy, error, reset, run } = useAction()

  // A landed Stop stays "Stopping…" until the end event flips `active`, so it can't be re-fired.
  const [stopRequested, setStopRequested] = useState(false)
  useEffect(() => setStopRequested(false), [runId])
  const stopping = busy || (stopRequested && active)

  // A landed Merge stays "Merge armed" (#1391): the authorization is a pre-commitment the session
  // honors when it ends, so there is nothing to press twice.
  const [mergeRequested, setMergeRequested] = useState(false)
  useEffect(() => setMergeRequested(false), [runId])

  const [confirmDelete, setConfirmDelete] = useState(false)

  const openApp = (target: 'files' | 'editor') => run(() => sendOpenInApp(projectId, target, runId ?? undefined), 'Failed to open.')
  const stopSession = () =>
    void run(() => sendStop(projectId, runId ?? undefined).then(() => true), 'Could not stop the session.').then(result => {
      if (result) setStopRequested(true)
    })
  const mergeSession = () => {
    if (!runId) return
    void run(() => sendMerge(projectId, runId), 'Could not arm the merge.').then(result => {
      if (result?.ok) setMergeRequested(true)
    })
  }
  const removeWorktree = () => {
    if (!runId) return
    void run(() => sendRemoveWorktree(projectId, runId), 'Could not remove the worktree.').then(result => {
      if (result !== undefined) onWorktreeRemoved?.()
    })
  }

  const name = label?.trim() || runId

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                type="button"
                aria-label="Session actions"
                className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
              />
            }
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>Session actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {githubUrl && (
            <DropdownMenuItem render={<a href={githubUrl} target="_blank" rel="noreferrer" />}>
              <Github className="h-3.5 w-3.5 shrink-0" /> Open on GitHub
            </DropdownMenuItem>
          )}
          {/* Named for what it actually opens (#1195): once a session's worktree is gone this
              resolves to the project root, and calling that "the session's folder" was a lie the
              user could not see. */}
          <DropdownMenuItem
            disabled={busy}
            onClick={() => void openApp('files')}
            title={runId && !hasOwnFolder ? 'This session no longer has its own checkout' : undefined}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />{' '}
            {runId ? (hasOwnFolder ? "Open session's folder" : 'Open project folder') : 'Open folder'}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={busy}>
              <Code className="h-3.5 w-3.5 shrink-0" /> Open in editor
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[15rem]">
              <DropdownMenuItem disabled={busy} onClick={() => void openApp('editor')}>
                <Code className="h-3.5 w-3.5 shrink-0" /> {runId ? "Open this session's checkout" : 'Open in your editor'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Preferred editor</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={busy}
                  closeOnClick={false}
                  onClick={() => updatePreferences({ editor: '' })}
                  className="items-start"
                >
                  <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', editor ? 'opacity-0' : 'opacity-100')} />
                  <OptionLabel label="Default" description="$FRAMEWORK_EDITOR, or code" />
                </DropdownMenuItem>
                {editorRows.map(e => (
                  <DropdownMenuItem
                    key={e.bin}
                    disabled={busy}
                    closeOnClick={false}
                    onClick={() => updatePreferences({ editor: e.bin })}
                    className="items-start"
                  >
                    <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', editor === e.bin ? 'opacity-100' : 'opacity-0')} />
                    <OptionLabel label={e.label} description={e.bin} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {session && (
            <DropdownMenuItem render={<a href={session.href} target="_blank" rel="noreferrer" />}>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {session.label.replace(' ↗', '')}
            </DropdownMenuItem>
          )}
          {/* The agent's session id (#1195), shown because it is the only handle on the
              conversation once you leave the dashboard, and clickable because on its own an id is
              not actionable: the click copies the command that reopens it in a terminal. Stays
              open on click so the confirmation is visible. */}
          {resumeCommand && info?.sessionId && (
            <DropdownMenuItem closeOnClick={false} onClick={copyResume} title={resumeCommand}>
              {copied ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="flex-1">
                {copied ? 'Copied' : info.workspace ? 'Copy resume command' : 'Copy session id'}
              </span>
              <span className="ml-auto pl-3 font-mono text-[10px] text-muted-foreground">
                {info.sessionId.slice(0, 8)}
              </span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {active && (
            <DropdownMenuItem disabled={stopping} onClick={() => void stopSession()}>
              <Square className="h-3 w-3 shrink-0 fill-current" /> {stopping ? 'Stopping…' : 'Stop session'}
            </DropdownMenuItem>
          )}
          {/* The user's Merge (#1391): the human authorization the merge gate (#1363) otherwise
              collects from the agent's signal. A pre-commitment, not an abort — the session still
              ends at its own natural end (#1390) and merges there. */}
          {active && runId && (
            <DropdownMenuItem disabled={mergeRequested || busy} onClick={() => mergeSession()}>
              <GitMerge className="h-3.5 w-3.5 shrink-0" /> {mergeRequested ? 'Merge armed' : 'Merge when finished'}
            </DropdownMenuItem>
          )}

          {((retainedWorktree && !active) || (onDeleted && !active)) && runId && <DropdownMenuSeparator />}
          {retainedWorktree && !active && runId && (
            <DropdownMenuItem disabled={busy} onClick={() => removeWorktree()}>
              <FolderX className="h-3.5 w-3.5 shrink-0" /> Remove worktree
            </DropdownMenuItem>
          )}
          {onDeleted && !active && runId && (
            <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-danger">
              <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete session
            </DropdownMenuItem>
          )}

          {error && <p className="px-2 py-1.5 text-xs text-danger">{error}</p>}
        </DropdownMenuContent>
      </DropdownMenu>

      {onDeleted && runId && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this session?"
          body={
            <>
              Deleting <span className="font-medium text-foreground">{name}</span> removes it from the dashboard for good — its
              history can&rsquo;t be recovered. Its branch and any pull request stay in git.
            </>
          }
          confirmLabel="Delete"
          confirmBusyLabel="Deleting…"
          fallbackError="Could not delete the session."
          onConfirm={() => sendDeleteSession(projectId, runId).then(result => (result.ok ? result : Promise.reject(new Error(result.error))))}
          onSuccess={onDeleted}
        />
      )}
    </>
  )
}
