import type { FileContent } from '@gemstack/the-framework'
import { ArrowLeft } from 'lucide-react'
import { onFileContent } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { Button } from './ui/button.js'
import { Markdown } from './Markdown.js'
import { ScrollArea } from './ui/scroll-area.js'

/** Where tickets and their plans live, repo-relative. The literal, not the package's Node-bound
 *  `TICKETS_DIR` const, so nothing drags the server graph into the browser bundle. */
const TICKETS_DIR = 'tickets'

/**
 * A ticket's plan filename from its own slug: `<stem>.plan.md` beside the ticket. The stem is the
 * ticket's `.md` name without the extension, so `2026-07-20_do-the-thing.md` plans as
 * `2026-07-20_do-the-thing.plan.md`. Exported so its one caller and the test agree on the spelling.
 */
export function planPath(slug: string): string {
  return `${TICKETS_DIR}/${slug.replace(/\.md$/, '')}.plan.md`
}

// One ticket's plan (#685): its `<stem>.plan.md` rendered as markdown, the destination of the
// tickets list's plan-column link. A plan is a plain repo file, so this reads it through the same
// confined `onFileContent` the file-preview cards use rather than a bespoke endpoint — the read
// already guards traversal and caps the length. `slug` is the ticket's filename, the same the list
// row and the detail route carry, so the plan is addressed by the ticket it belongs to.
export function TicketPlanPage({
  projectId,
  slug,
  onBack,
}: {
  projectId: string
  /** The ticket's filename inside `tickets/`, same as `WorkspaceTicket.file`. */
  slug: string
  /** Back to the tickets list. */
  onBack: () => void
}) {
  const path = planPath(slug)
  const { value: plan, loaded } = usePolled<FileContent | null>(() => onFileContent(projectId, path), null, 10_000, [projectId, path])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Tickets
        </Button>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{path}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl p-6">
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !plan || plan.binary ? (
            // No `.plan.md` beside the ticket — never written, or removed since the list read.
            <p className="text-sm text-muted-foreground">This ticket has no plan yet.</p>
          ) : (
            <>
              <Markdown text={plan.text} />
              {/* The confined read caps long files; say so rather than pretending the tail is empty. */}
              {plan.truncated && <p className="mt-4 text-xs text-muted-foreground">Plan truncated — open the file to read the rest.</p>}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
