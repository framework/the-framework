import { useState } from 'react'
import { BrowserPanel } from './BrowserPanel.js'

/**
 * The browser preview inline in the transcript (#1455 item 6b): the body of the latest
 * `browser` row. A fixed 16:10 box capped at max-h-96, full column width, the screencast
 * letterboxed inside — the same proxied stream the rail's Browser tab shows, so the two
 * surfaces can never disagree about what the browser is doing.
 *
 * The degrade ladder (#1359 — never a dead control): while the run is live the box holds the
 * interactive BrowserPanel, which hands back a still of the newest frame every couple of
 * seconds. When the run ends under the reader (`live` flips false on the mounted component),
 * the box keeps that last still with a one-line overlay saying the preview ended — never a
 * dead stream, never a spinner. No still captured (the reader arrived after the end, or no
 * frame ever painted) → the row is just its one-liner. The still lives only in this viewer's
 * memory, upholding the frames-never-enter-the-log rule.
 */
export function InlineBrowser({
  projectId,
  runId,
  url,
  live,
}: {
  projectId: string
  runId: string
  /** The page this row announced — what the one-liner names when there is nothing to show. */
  url: string
  /** Whether the run (and so the stream) is still going; false degrades the pane in place. */
  live: boolean
}) {
  const [frame, setFrame] = useState<string | undefined>(undefined)
  if (!live && frame === undefined) {
    return <span className="font-mono text-foreground">browser · {url}</span>
  }
  return (
    <div className="relative aspect-[16/10] max-h-96 w-full overflow-hidden rounded-md border border-border bg-muted">
      {live ? (
        <BrowserPanel inline projectId={projectId} runId={runId} onFrame={setFrame} />
      ) : (
        <>
          <img src={frame} alt="The browser's last frame" className="h-full w-full object-contain" />
          <p className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
            preview ended — session finished
          </p>
        </>
      )}
    </div>
  )
}
