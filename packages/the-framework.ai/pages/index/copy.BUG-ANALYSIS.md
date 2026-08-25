# Bug analysis: packages/the-framework.ai/pages/index/copy.ts

## Business logic (high-level)

`useCopy()` is the click-to-copy behavior behind every copyable snippet on the site: the hero's try-box and install chip, and the three command chips on `/go-to-dashboard`. `copy.SPEC.md` pins three rules:

1. **Selecting text is never hijacked** — a click that is part of a double/triple-click, or made while something on the page is already selected, must not copy.
2. **The badge waits out a selection** — if text is selected when the "copied!" badge is due to disappear, it stays 2 seconds longer rather than changing under the visitor's hands.
3. **Copying always reports success** — a clipboard denial falls back to an off-screen `<textarea>` + `execCommand('copy')`, and even a failing fallback still shows the badge, because the visitor can always select the text by hand.

How the implementation meets them, and where it does not:

- **Rule 1** is implemented by the two early returns: `e.detail > 1` catches the 2nd/3rd click of a multi-click (every call site passes the React click event, so the guard is live everywhere), and the `window.getSelection()` length check catches a click made with an existing selection. The `?? ''` guard is for the (spec-legal) `null` return in a detached document; `String(selection)` uses `Selection.toString()`.
- **Rule 2** is the nested timeout: at +1500ms, if something is selected, re-arm for +2000ms and then clear unconditionally. Clearing unconditionally after the extra 2s is exactly what the SPEC asks ("stays 2 seconds longer"), not a bug.
- **Rule 3** is the `writeText(...).then(done, fallback)` pair: the rejection handler is a real handler, so a denied clipboard cannot surface as an unhandled rejection; `execCommand` is wrapped in `try/catch`; and `done()` runs in the fallback regardless of whether the copy actually succeeded.

**Timer ownership is the weak point.** The state is a single `copied` boolean plus anonymous `setTimeout`s that nothing tracks: no ref, no `clearTimeout`, no cleanup on unmount. Two consequences, one visible (see Bugs found) and one benign: a pending timer that fires after the component unmounted (Vike client-side navigation from `/` to `/press` unmounts the hero) calls `setCopied` on an unmounted component, which React 18+ ignores silently — not a leak, since the timer is at most 3.5s long and holds only the closure.

**Concurrency.** `copy()` can be re-entered while an earlier `writeText` promise is still pending (the async gap is the only window). Each call schedules its own `done()`; the resulting overlapping timers are the source of the bug below.

**SSR.** The module touches `window`/`navigator`/`document` only inside `copy()`, which only ever runs from a click handler — so the prerender build never evaluates them.

## Functions (low-level)

- **`useCopy()`** — returns `{ copied, copy }`. `copied` drives the badge label and the `.copied` class; `copy` is recreated each render but is only ever used as an event handler, so no memoisation is needed and no stale closure exists (it reads only `text`/`e` arguments and the stable `setCopied`). Verdict: bug found (badge timing, below).
- **`copy(text, e?)`** — the whole behavior. Inputs: the resolved command string (always non-empty at every call site) and an optional object with `detail`. Edge cases: `e` omitted → the multi-click guard is skipped (no call site omits it today); `text` is never empty; `navigator.clipboard` missing (non-secure context) → straight to the fallback; `writeText` rejecting (permission denied / document not focused) → fallback. Verdict: bug found.
- **`done()`** — sets `copied` and schedules the 1500ms expiry with the selection-aware extension. Verdict: bug found (untracked timer).
- **`fallback()`** — creates a `position: fixed; opacity: 0` `<textarea>`, selects it, `execCommand('copy')`, removes it, then `done()`. Correct in the essentials: the element is removed even when `execCommand` throws (`ta.remove()` is after the `try/catch`, not inside a `finally`-less `try`), and `opacity: 0` (rather than `display: none`) keeps it selectable. Two soft spots: it gives no `top`/`left`, so the fixed box sits at its static position — the end of `<body>`, i.e. potentially far below the viewport — and `ta.select()` focuses it, which can make the browser attempt a scroll-into-view; and the element is appended to `document.body` rather than near the click. Both only matter on the fallback path (clipboard denied or insecure context), which the production HTTPS site rarely reaches. Verdict: suspicious-but-unproven (reported at low confidence).

## Bugs found

1. `L15`: **A second copy click within 1.5s makes the "copied!" badge disappear early.** Each `done()` schedules an untracked 1500ms timer, and nothing cancels the previous one. Concretely: click the hero's try-box, then click it again 1s later (two separate single clicks, so `e.detail` is 1 and neither is filtered) — the first click's timer fires 500ms after the second copy and sets `copied` to `false`, so the visitor's second copy flashes "copied!" for a third of the promised time. `copy.SPEC.md` states the label turns into "copied!" *for 1.5 seconds*, and the file's own comment calls the badge timing the point of the hook. Severity: minor. Fix: keep the timeout id in a `useRef`, `clearTimeout(ref.current)` at the start of `done()` (and for the nested 2000ms timer), storing each new id.
2. `L26`: **The clipboard fallback's off-screen textarea can scroll the page.** `ta.style.cssText = 'position:fixed;opacity:0'` sets no `top`/`left`, so the element resolves to its static position — the end of the document body — and `ta.select()` focuses it, which can prompt the browser to scroll toward it. Trigger: any visitor whose browser rejects `navigator.clipboard.writeText` (permission denied, or an insecure-context deployment/preview) clicks a copy chip and the page jumps. Severity: minor. Confidence: low (only reachable on the fallback path, and browsers differ in whether they scroll for a fixed-position target). Fix: add `top:0;left:0` (or `left:-9999px`) to the `cssText`.
