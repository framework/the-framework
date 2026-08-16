import { AgentFeed } from './AgentFeed.js'
import { Badge } from './ui/badge.js'
import { useLiveEvents } from '../lib/use-live-events.js'
import { isAgentActive } from '../lib/live-state.js'
import { useFavicon } from '../lib/favicon.js'
import { Logo } from './Logo.js'

// The shared-agent watch view (#426/#230): when the dashboard is opened on the relay at
// `/?run=<id>`, it shows one agent read-only, streamed from the relay's in-memory event
// feed over the same `GET /_rpc/events` stream the daemon uses. No Projects/Runs/Docs
// rails and no steering — a teammate with the link watches, they do not drive.
export function RelayView({ agentId: agentId }: { agentId: string }) {
  // The agent id rides in the projectId slot: the relay keys `onEvents` by it (no registry).
  const { events, lost, done } = useLiveEvents(agentId)
  // The mark and the tab icon (#875) follow the one agent being watched, since that is all the
  // relay knows about — it has no project registry to ask.
  const working = isAgentActive(events)
  useFavicon(working)
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Logo className="h-5 w-auto shrink-0" working={working} />
        <span className="font-semibold">The Framework</span>
        <Badge className="text-muted-foreground">watching</Badge>
        <span className="ml-auto text-xs text-muted-foreground">read-only shared session</span>
      </header>
      <main className="flex min-w-0 flex-1 flex-col">
        {/* An unknown or ended run closes the channel cleanly with nothing streamed; saying so
            beats "Waiting for the session to start…" forever (#948). */}
        {events.length === 0 && done ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground">
            This shared session isn&rsquo;t available — it may have ended, or the link may be wrong.
          </div>
        ) : (
          <AgentFeed events={events} lost={lost} />
        )}
      </main>
    </div>
  )
}
