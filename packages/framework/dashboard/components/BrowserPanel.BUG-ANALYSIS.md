# Bug analysis: packages/framework/dashboard/components/BrowserPanel.tsx

## Business logic (high-level)

Live view of the agent's headless Chrome (#813/#802): an `<img>` pointed at the daemon-proxied MJPEG
stream `/browser/{projectId}/{agentId}/stream`, with clicks/scrolls/keys POSTed back to
`{base}/input`. Two shapes (rail pane vs `inline` transcript row), failure state with Retry that is
keyed per attempt (#946), and an `onFrame` still-capture callback (#1455 6b) for InlineBrowser's
degrade-to-still behavior (#1359).

Invariants checked against `BrowserPanel.SPEC.md`:

- **Failure never latches across streams.** `failedKey` stores the exact `base#attempt` it happened
  on; `failed` is a derived comparison. Retry bumps `attempt` (new key), and a `base` change resets
  `attempt`/`failedKey` via the adjust-during-render pattern (`lastBase` state, L44–49) — correct
  React idiom, runs before commit, no effect-timing hole. Matches all four tests.
- **Retry re-issues the request**: `src` carries `?r=${attempt}` so the browser cannot serve the
  failed attempt from cache/coalescing. Correct.
- **Coordinate translation**: click/scroll positions scaled from displayed box to
  `naturalWidth/Height`. Correct for letterboxed `inline` too, because the `img` box itself keeps
  the aspect ratio (`max-h-full max-w-full` shrinks the element, not the content within a larger
  element box) — the img element's content box equals the drawn frame, so the linear map holds.
- **Key filter**: only `key.length === 1` without meta/ctrl is sent, `preventDefault()`ed. Enter,
  Backspace, arrows are deliberately not sent (SPEC states single-character keys only) — noted as a
  product limitation the SPEC owns (a user at a login wall cannot press Enter; they must click the
  submit button). Alt-composed characters (length 1) are sent, which is arguably intended text.
- **Still capture**: interval only when `onFrame` given; skips until `naturalWidth` set; try/catch
  for half-decoded frames per SPEC; cleaned up on unmount. `InlineBrowser` passes a `setState`
  (stable identity) so the `[onFrame]` dep does not churn the interval. Same-origin stream, so the
  canvas is not tainted and `toDataURL` succeeds.

Concurrency/lifecycle concern found: nothing closes the MJPEG connection on unmount — see Bugs.

## Functions (low-level)

### `BrowserPanel({ projectId, agentId, inline, onFrame })`

- Path building L40: `encodeURIComponent` on both ids — no path traversal / URL-breaking on odd ids.
- Adjust-during-render L44–49: `setLastBase`/`setAttempt`/`setFailedKey` during render — sanctioned
  pattern; re-render happens synchronously before DOM update, so a stale `src` never commits.
- Verdict: bug found (unmount leak, below); otherwise correct.

### still-capture effect (L53–71)

Every 2s draw the img to a canvas, hand `toDataURL('image/jpeg', 0.7)` up. Edge cases: `img.current`
null while failed-state is shown (interval keeps ticking but no-ops — harmless); canvas context
null → skip; decode race → catch. Interval cleared on unmount/`onFrame` change. Verdict: correct.

### `toPageCoords(event)` (L78–85)

Maps client coords to page coords via bounding box and naturalWidth/Height with `|| box.width`
fallback before the first frame (naturalWidth 0). Division by zero impossible in practice (a
0-width img cannot receive a click). Rounding fine. Verdict: correct.

### `send(body)` (L87–93)

Fire-and-forget POST, JSON, `.catch(() => {})`. Input loss on network error is silent, but the SPEC
treats input as best-effort against a live stream the user is watching (feedback = the stream
itself). Verdict: correct.

### Render (L95–145)

- Failed branch: message + Retry (`setAttempt(a => a + 1)`). Matches SPEC copy.
- `onWheel` sends a scroll but cannot `preventDefault()` (React root wheel listeners are passive),
  so the rail container (`overflow-auto`) may scroll locally at the same time as the page scrolls
  remotely. Double-scroll UX quirk; SPEC is silent, browser constraint makes the obvious fix
  unavailable — recorded as a note, not a bug.
- `tabIndex={0}` + focus ring: keystroke landing spot per SPEC. Correct.

## Bugs found

1. `L118` (fix belongs here, in an unmount cleanup): the MJPEG stream connection is never closed
   when the panel unmounts. `multipart/x-mixed-replace` responses never complete, and a detached
   `<img>` element's in-flight load is not canceled by removal from the DOM (the element is kept
   alive by its active load), so every unmount of the panel — switching the right-rail tab away
   from Browser, navigating from the agent view to the overview, collapsing an inline row — can
   strand an open HTTP connection to the daemon. Scenario: toggle the Browser rail tab open/closed
   a handful of times; over HTTP/1.1 the per-origin connection limit (6 in Chrome) fills with dead
   streams and the dashboard's own SSE/RPC requests stall. Contradicts intent: the SPEC's failure
   handling is careful about stream lifecycle, and a leaked live stream is a resource leak by the
   project's own bug definition. (Agent *switches* are safe — the same `<img>` gets a new `src`,
   which aborts the previous load; only unmount leaks.) Severity: major. Confidence: medium (depends
   on browser GC of actively-loading detached images; the standard MJPEG-viewer mitigation exists
   precisely because browsers keep these alive). Fix sketch: `useEffect(() => () => { if (img.current)
   img.current.src = '' }, [])` — clearing `src` on unmount aborts the multipart load.

No other bugs found.
