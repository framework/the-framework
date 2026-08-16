import type { WorkspaceDoc } from '../../dist/index.js'
import { onDocs } from '../rpc/reads.js'
import { usePolled } from '../lib/use-async.js'
import { DocsPanel } from './DocsPanel.js'

/** Stable initial for the poll, so it does not churn on every render. */
const EMPTY_DOCS: WorkspaceDoc[] = []

/**
 * The workspace's PLAN/TODO docs on the launcher (#1455 item 2): moved out of the right rail
 * into the main column, same DocsPanel presentation. A project with no docs gets no section —
 * the rail's earned-by-content rule (#1146) applies here unchanged. The section caps its own
 * height so a long PLAN scrolls inside it rather than taking the whole launcher column.
 */
export function ProjectDocs({ projectId }: { projectId: string }) {
  const { value: docs, loaded } = usePolled<WorkspaceDoc[]>(() => onDocs(projectId), EMPTY_DOCS, 4000, [projectId])
  if (!loaded || docs.length === 0) return null
  return (
    <section aria-label="Docs" className="border-t border-border p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Docs</h2>
      <div className="flex max-h-[28rem] flex-col overflow-hidden rounded-md border border-border">
        <DocsPanel docs={docs} loaded />
      </div>
    </section>
  )
}
