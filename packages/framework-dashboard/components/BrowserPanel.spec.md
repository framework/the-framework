The session's live headless-Chrome view in the right rail (#813): an MJPEG `<img>` plus click/scroll/key input posted back.

## TLDR

- The session serves Chrome as MJPEG (`multipart/x-mixed-replace`, #802) and the daemon proxies it same-origin at `/browser/:projectId/:runId/stream`; an `<img>` renders the stream natively, so there is no player code.
- Input goes as JSON POSTs to `…/input`: `{type:'click', x, y}`, `{type:'scroll', x, y, deltaY}`, `{type:'key', text}`; the frame has `tabIndex={0}` so keystrokes have somewhere to land.
- This makes the `await-browser` gate (#796) actionable: the session parks asking a human to get past a login wall, and this is how they reach the page.
- On `<img>` error shows a "not reachable" card with Retry; the footer notes Chrome only sends a frame when the page changes.

## Problems

- Rail pixels are not page pixels: frames are capped 1280x720 by the screencast then scaled to fit, so `toPageCoords` rescales click coordinates by `naturalWidth/Height` over the bounding box.
- Failure latching (#946): one early `onError` (tab opened before the run's stream endpoint was up) must not be terminal. The failure is keyed to the exact stream (`${base}#${attempt}`), so a Retry or a different run starts clean instead of inheriting "not reachable" until remount.
- The parent switches runs without remounting: an adjust-during-render block (`lastBase !== base` → reset attempt/failure) is the sanctioned way to reset state on a prop change.

## Facts

- Retry bumps `attempt`, which changes the stream URL query (`?r=N`) so the browser re-issues the request instead of replaying the failed one.
- Key input forwards only single characters without meta/ctrl — `insertText` types literally, so a bare "Shift" or "ArrowLeft" would otherwise be inserted as those strings.
