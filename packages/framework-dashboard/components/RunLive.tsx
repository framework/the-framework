import type { FrameworkEvent } from '@gemstack/framework'
import { sendStop } from '../server/control.telefunc.js'
import { useAction } from '../lib/use-action.js'
import { PreviewBar } from './PreviewBar.js'
import { RunFeed } from './RunFeed.js'
import { Button } from './ui/button.js'

// One running run's own view (its output): the run overview + the live event feed from the
// shared Telefunc Channel, plus a Stop control. Distinct from the home launcher (ProjectHome)
// and a finished run's replay (RunReplay). Single-run today streams the project's one live
// feed; per-run streams arrive with worktrees (#453).
export function RunLive({ projectId, events }: { projectId: string; events: FrameworkEvent[] }) {
  // Stop routes through useAction like every other mutation, so a click disables + shows
  // "Stopping…" and a failed stop surfaces instead of silently doing nothing (#627-adjacent UX).
  const { busy, error, run } = useAction()
  return (
    <>
      <PreviewBar projectId={projectId} />
      <div className="flex items-center justify-end gap-3 border-b border-border px-4 py-2">
        {error && <span className="text-xs text-red-500">{error}</span>}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void run(() => sendStop(projectId), 'Could not stop the run.')}
        >
          {busy ? 'Stopping…' : 'Stop run'}
        </Button>
      </div>
      <RunFeed events={events} />
    </>
  )
}
