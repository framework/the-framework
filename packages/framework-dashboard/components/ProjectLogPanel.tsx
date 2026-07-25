import type { LogEntry } from '@gemstack/the-framework'
import { Badge } from './ui/badge.js'
import { cn } from '../lib/utils.js'
import { formatDateTime } from '../lib/format-date.js'
import { STATUS_TONE } from '../lib/status-tone.js'
import { ScrollArea } from './ui/scroll-area.js'

// The committed project log (#378/#379): `.the-framework/LOGS.md`, every finished
// loop/prompt/build run newest-first, over a Telefunc RPC (server/reads.telefunc.ts).
// Read in the rail like its sibling panels (#1146), so an entry a run appends on finishing shows
// up without a project switch, and an empty log costs no tab.
export function ProjectLogPanel({ logs, loaded }: { logs: LogEntry[]; loaded: boolean }) {
  // Loading and empty are different facts (#948) — same guard as the Tickets panel.
  if (!loaded) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  if (logs.length === 0) return <p className="p-4 text-sm text-muted-foreground">No committed log entries yet.</p>

  return (
    <ScrollArea className="min-h-0 flex-auto">
      <ul className="divide-y divide-border">
      {logs.map((log, i) => (
        <li key={i} className="px-4 py-2">
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] uppercase text-muted-foreground">{log.kind}</Badge>
            <Badge className={cn('border-transparent px-0 text-[10px] uppercase', STATUS_TONE[log.status])}>{log.status}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(log.at)}</span>
          </div>
          <p className="mt-1 text-sm">{log.title}</p>
        </li>
      ))}
      </ul>
    </ScrollArea>
  )
}
