import { useEffect } from 'react'
import { Github, FolderOpen, Code } from 'lucide-react'
import { onGithubUrl } from '../rpc/reads.js'
import { sendOpenInApp } from '../rpc/control.js'
import { useLoaded } from '../lib/use-async.js'
import { useAction } from '../lib/use-action.js'
import { Button, buttonVariants } from './ui/button.js'
import { PreferredEditorItems } from './PreferredEditorItems.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu.js'

// What you can do to a checkout: open it on GitHub (#489), in the file manager or an editor
// (#490), and serve it (#475). One component for both pages (#809) — the project home passes no
// session and acts on the project's tree, a session passes its id and every action addresses its
// own worktree instead. Opening a session in your editor is the whole point of a worktree, and
// that was the one page where you could not.
export function WorkspaceActions({
  projectId,
  agentId: agentId,
}: {
  projectId: string
  /** The session to act on; absent acts on the project's checkout. */
  agentId?: string | null | undefined
}) {
  // The repo link is the project's either way: a session is a branch of that same repo, and its
  // branch may not be pushed anywhere yet. Its PR, when there is one, shows in the git status.
  // keepPrevious: hold the GitHub icon while a new project's URL loads, so it does not pop out and
  // back and shove the icon row (within a project it is already stable, keyed on projectId).
  const githubUrl = useLoaded<string | null>(() => onGithubUrl(projectId), null, [projectId], true)
  const { busy, error, reset, run } = useAction()

  // `error` belongs to open(), not to the read, so clearing it on a switch is its own effect:
  // otherwise the last checkout's failure stays on screen next to the new one's actions.
  useEffect(() => reset(), [projectId, agentId, reset])

  const open = (target: 'files' | 'editor') =>
    run(() => sendOpenInApp(projectId, target, agentId ?? undefined), 'Failed to open.')

  return (
    <>
      {githubUrl && (
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
              />
            }
          >
            <Github className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>Open on GitHub</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="outline" size="icon-sm" disabled={busy} onClick={() => void open('files')} />}
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent>{agentId ? "Open this agent's folder" : 'Open folder'} (Finder / Explorer)</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                type="button"
                disabled={busy}
                aria-label="Open in editor"
                className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
              />
            }
          >
            <Code className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>Open in editor</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-[15rem]">
          <DropdownMenuItem disabled={busy} onClick={() => void open('editor')}>
            <Code className="h-3.5 w-3.5 shrink-0" />
            {agentId ? "Open this agent's checkout" : 'Open in your editor'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <PreferredEditorItems busy={busy} />
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Serve (#475) the checkout this bar is about: the project's, or the session's own (#797). */}
      {error && <span className="text-xs text-danger">{error}</span>}
    </>
  )
}
