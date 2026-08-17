import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button.js'

/**
 * The session's browser, live in the right rail (#813) and inline in the transcript (#1455 6b).
 *
 * The session serves its headless Chrome as MJPEG (#802) and takes clicks and keys back over
 * POST; the daemon proxies both so this stays same-origin. An `<img>` renders
 * `multipart/x-mixed-replace` natively, so there is no player here — the browser is the player.
 *
 * This is the half that makes the `await-browser` gate (#796) actionable: the session parks
 * asking a human to get past a login wall, and until now that human had no way to reach the page.
 */
export function BrowserPanel({
  projectId,
  agentId: agentId,
  inline,
  onFrame,
}: {
  projectId: string
  agentId: string
  /** Transcript-row variant (#1455 item 6b): fill and letterbox into the box the row provides
   *  instead of the rail's scroll column, and drop the footer help text — container styles
   *  only, the same split ChoicePanel's `inline` makes. */
  inline?: boolean
  /**
   * Called with a data-URL still of the newest frame every couple of seconds while streaming
   * (#1455 item 6b). The caller keeps it so a pane whose agent ends can degrade to that still
   * instead of a dead stream (#1359). The frame lives only in this viewer's memory — never in
   * the log or on disk, the same rule the stream itself follows.
   */
  onFrame?: (dataUrl: string) => void
}) {
  const img = useRef<HTMLImageElement>(null)
  const [attempt, setAttempt] = useState(0)
  // The failure is keyed to the exact stream it happened on, so a different agent or a Retry
  // starts clean instead of inheriting a latched "not reachable" until remount (#946): one
  // early onError (the tab opened before the agent's stream endpoint was up) must not be terminal.
  const [failedKey, setFailedKey] = useState<string | undefined>(undefined)
  const base = `/browser/${encodeURIComponent(projectId)}/${encodeURIComponent(agentId)}`
  // Coming back to an agent whose earlier stream failed must try again, not replay the stale
  // failure: the stream may have come up since. Adjust-during-render is the sanctioned way
  // to reset state on a prop change without a remount.
  const [lastBase, setLastBase] = useState(base)
  if (lastBase !== base) {
    setLastBase(base)
    setAttempt(0)
    setFailedKey(undefined)
  }
  const streamKey = `${base}#${attempt}`
  const failed = failedKey === streamKey

  useEffect(() => {
    if (!onFrame) return
    const timer = setInterval(() => {
      const el = img.current
      if (!el || !el.naturalWidth) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = el.naturalWidth
        canvas.height = el.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(el, 0, 0)
        onFrame(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        // A half-decoded frame throws; skip it and take the next tick's.
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [onFrame])

  /**
   * Where the click landed on the real page. The frame is capped at 1280x720 by the screencast
   * and then scaled again to fit the rail, so a rail pixel is not a page pixel: sending the
   * former clicks the wrong thing on any pane that is not exactly life-size.
   */
  const toPageCoords = (event: React.MouseEvent<HTMLImageElement>) => {
    const el = event.currentTarget
    const box = el.getBoundingClientRect()
    return {
      x: Math.round(((event.clientX - box.left) / box.width) * (el.naturalWidth || box.width)),
      y: Math.round(((event.clientY - box.top) / box.height) * (el.naturalHeight || box.height)),
    }
  }

  const send = (body: unknown) => {
    void fetch(`${base}/input`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  if (failed) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        <p className="mb-2">
          The preview is not reachable. It ends with the session, and a session only has one when it was started with
          Browser on. If it just started, the stream may not be up yet.
        </p>
        <Button variant="outline" size="xs" onClick={() => setAttempt(a => a + 1)}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={inline ? 'flex h-full min-h-0 w-full flex-col' : 'flex min-h-0 flex-auto flex-col'}>
      <div
        className={
          inline ? 'flex min-h-0 flex-1 items-center justify-center overflow-hidden' : 'min-h-0 flex-auto overflow-auto p-2'
        }
      >
        {/* tabIndex makes the frame focusable so keystrokes have somewhere to land; the ring
            shows where they will land. */}
        <img
          ref={img}
          src={`${base}/stream?r=${attempt}`}
          alt="The agent's browser"
          tabIndex={0}
          className={`cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
            inline ? 'max-h-full max-w-full' : 'w-full rounded border border-border bg-muted'
          }`}
          onError={() => setFailedKey(streamKey)}
          onClick={event => send({ type: 'click', ...toPageCoords(event) })}
          onWheel={event => send({ type: 'scroll', ...toPageCoords(event), deltaY: event.deltaY })}
          onKeyDown={event => {
            // Only real text goes through: `insertText` types a character, so a bare modifier or
            // an arrow key would otherwise insert the literal string "Shift" or "ArrowLeft".
            if (event.key.length !== 1 || event.metaKey || event.ctrlKey) return
            event.preventDefault()
            send({ type: 'key', text: event.key })
          }}
        />
      </div>
      {!inline && (
        <p className="border-t border-border p-2 text-xs text-muted-foreground">
          Click the frame, then type. Chrome only sends a frame when the page changes, so this stays blank until the
          agent opens something.
        </p>
      )}
    </div>
  )
}
