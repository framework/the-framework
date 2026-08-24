# Bug analysis: packages/framework/dashboard/components/InlineBrowser.tsx

## Business logic (high-level)

The transcript's inline browser pane (#1455 item 6b), implementing the #1359 degrade ladder the
SPEC states: `live` → 16:10 box hosting the interactive `BrowserPanel` (which hands back a
data-URL still via `onFrame` every ~2s); `live` flips false on the mounted component → keep the
last still with the "preview ended — session finished" overlay; not live and no still ever
captured (reader arrived post-end, or no frame painted) → just the `browser · <url>` one-liner.
The still lives only in this component's state — frames never enter the log, per the SPEC.

Edge cases / lifecycle checked:

- `setFrame` is a `useState` setter, stable across renders, so BrowserPanel's `[onFrame]`-keyed
  capture interval is set up once and cleared on unmount (verified in BrowserPanel: the effect
  returns `clearInterval`). No leak, no per-render interval churn.
- `live` false→true resurrection: cannot happen to a mounted instance in the one caller
  (EventList moves the pane to the *new* `browser` row, which mounts fresh), and if it did the
  component simply renders the live pane again — harmless.
- A first frame arriving only after `live` flipped false: impossible for the interval path (it is
  torn down with BrowserPanel on the same render that flips `live`), so no post-degrade state
  writes.
- The one-liner keeps the row honest for readers with nothing to show; its `browser · url`
  wording is deliberately distinct from the formatter's live `browser: url` line (the EventList
  tests rely on the difference).
- `frame` is rendered raw into `img src` — it is always a same-origin canvas `toDataURL` product,
  never remote input. Safe.

## Functions (low-level)

- `InlineBrowser({projectId, agentId, url, live})`: the whole file.
  - State: `frame: string | undefined`.
  - Branch 1 (`!live && frame === undefined`): one-liner span. Correct.
  - Branch 2 (`live`): fixed-aspect box (`aspect-[16/10] max-h-96`) with `BrowserPanel inline`
    letterboxing inside (BrowserPanel's `inline` variant uses `max-h-full max-w-full`). Correct.
  - Branch 3 (`!live && frame`): `<img src={frame} alt="The browser's last frame">` +
    absolute-positioned overlay line. `object-contain` letterboxes the still like the live pane.
    Correct.
  - Hook order: `useState` before the conditional return — stable. Correct.

## Bugs found

None found.
