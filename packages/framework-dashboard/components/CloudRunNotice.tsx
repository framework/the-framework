import { Cloud, ExternalLink } from 'lucide-react'
import type { FrameworkEvent } from '@gemstack/the-framework'
import { cloudSession } from '../lib/live-state.js'
import { CopyButton } from './ui/copy-button.js'

// The run view's affordance for a Claude web target (#610). This target is a hand-off, not a
// streamed run: the session runs on Anthropic's infrastructure, does its own worktree and opens
// its own PR, and there is no read-back API to follow it with — so the honest thing to show is
// where the work went and how to reach it, rather than an empty feed that looks stalled.
// Renders nothing for any other target, so the run view can mount it unconditionally.
export function CloudRunNotice({
  target,
  events,
}: {
  target?: 'local' | 'actions' | 'remote' | 'web' | undefined
  events: readonly FrameworkEvent[]
}) {
  if (target !== 'web') return null
  const session = cloudSession(events)
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
      <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        {session
          ? 'Running as a Claude Code cloud session. It opens its own pull request when it is done.'
          : 'Starting a Claude Code cloud session…'}
      </span>
      {session && (
        <>
          <span className="inline-flex shrink-0 items-center gap-1">
            <code className="rounded bg-muted px-1 py-0.5">claude --teleport {session.id}</code>
            <CopyButton text={`claude --teleport ${session.id}`} label="Copy the command that continues this session here" />
          </span>
          <a
            href={session.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
          >
            Open the session
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </>
      )}
    </div>
  )
}
