The session's live headless-Chrome view in the right rail (#813) and inline in the transcript (#1455 item 6b): an MJPEG `<img>` plus click/scroll/key input posted back.

## TLDR

- The session serves Chrome as MJPEG (`multipart/x-mixed-replace`, #802) and the daemon proxies it same-origin at `/browser/:projectId/:runId/stream`; an `<img>` renders the stream natively, so there is no player code.
- Input goes as JSON POSTs to `…/input`: `{type:'click', x, y}`, `{type:'scroll', x, y, deltaY}`, `{type:'key', text}`; the frame has `tabIndex={0}` so keystrokes have somewhere to land.
- This makes the `await-browser` gate (#796) actionable: the session parks asking a human to get past a login wall, and this is how they reach the page.
- On `<img>` error shows a "not reachable" card with Retry; the footer notes Chrome only sends a frame when the page changes.
- `inline` (#1455 item 6b) is the transcript-row variant, container styles only (the ChoicePanel split): fill and letterbox into the box the row provides, drop the footer help text. The Retry card and all input wiring are shared.
- `onFrame` hands the caller a data-URL still of the newest frame every ~2s while streaming, so a pane whose run ends can degrade to that still (#1359). The still lives only in the viewer's memory — frames never enter the log or disk, the stream's own rule. Canvas capture is best-effort: no 2d context (jsdom) or a half-decoded frame just skips the tick.

## Problems

- Rail pixels are not page pixels: frames are capped 1280x720 by the screencast then scaled to fit, so `toPageCoords` rescales click coordinates by `naturalWidth/Height` over the bounding box.
- Failure latching (#946): one early `onError` (tab opened before the run's stream endpoint was up) must not be terminal. The failure is keyed to the exact stream (`${base}#${attempt}`), so a Retry or a different run starts clean instead of inheriting "not reachable" until remount.
- The parent switches runs without remounting: an adjust-during-render block (`lastBase !== base` → reset attempt/failure) is the sanctioned way to reset state on a prop change.

## Facts

- Retry bumps `attempt`, which changes the stream URL query (`?r=N`) so the browser re-issues the request instead of replaying the failed one.
- Key input forwards only single characters without meta/ctrl — `insertText` types literally, so a bare "Shift" or "ArrowLeft" would otherwise be inserted as those strings.
