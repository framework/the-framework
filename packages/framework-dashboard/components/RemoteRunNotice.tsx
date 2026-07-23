import { MonitorSmartphone } from 'lucide-react'

// The run view's banner for a session running on a connected device (#1067, slice 2). Its live feed,
// diff, worktree, handoff, and push/PR all relay back through the local daemon and render normally; the
// one thing still local-only is the browser preview (slice 3), so this only flags where the run executes
// and that the screencast is not available for a remote run yet. Renders nothing without a device label,
// so the run view can mount it unconditionally.
export function RemoteRunNotice({ device }: { device?: string | undefined }) {
  if (!device) return null
  return (
    <div role="status" className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
      <MonitorSmartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        Running on {device}. Its worktree, diff, and pull request live on the device; the browser preview is not available for remote runs yet.
      </span>
    </div>
  )
}
