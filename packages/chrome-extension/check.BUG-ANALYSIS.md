# Bug analysis: packages/chrome-extension/check.mjs

## Business logic (high-level)

Offline harness for the content script: runs `content.js` inside jsdom pages built to look like
claude.ai session and new-session pages, with no browser and no extension runtime (`chrome` is
undefined, so the script exposes `__tfBridgeQuestion`, `__tfBridgeTranscript`,
`__tfBridgeDeliverAnswer`, `__tfBridgeCreateSession`, `__tfBridgeProbeNewSession`). Exit code 1
when any case fails. What it pins, per `check.SPEC.md`:

- **Extraction** (14 table cases): the block found in fenced code, `pre` without `code`, bare
  `code`, wide indentation, highlighter-split spans, prose-surrounded, inside a shadow root; a
  no-question page reports none; the protocol spec block loses to a real question and never wins
  alone; the two literal examples (browser-handoff, "Ship this?") never count; decoys inside the
  opening turn (`data-index="0"`) are ignored while a later real question wins; a question-shaped
  block only in the opening turn is never reported. Each case also asserts the composer was found
  and (for positive cases) that the panel shows the real title — so the assertions genuinely
  check the panel output, not just absence of a crash.
- **Wire shape**: `multi`, per-option `default`/`stop`, labels and details reach
  `__tfBridgeQuestion` exactly, unknown keys dropped, sessionId from the URL.
- **Mirror**: one entry per turn keyed by the page's `data-index`, roles mapped, markers skipped,
  glyphs/blank lines removed, the opening prompt head-capped at 8000; tail-only rendering keeps
  page positions; a page with no turn rows mirrors nothing and the panel says so.
- **Delivery**: composer filled and send button clicked (verified via a real click listener and
  the composer's text content); Enter fallback verified via a keydown listener; a composer-less
  page is refused with the reason (composer wait shortened via `__tfComposerWaitMs`).
- **Creation**: a synthetic new-session page (combobox chips repo→branch→add, searchable pickers
  as dialogs, send button that pushes a session URL) exercised in the three remembered states,
  with glyph-decorated labels, a missing branch (nothing sent, branch named), a missing repo
  picker (named, probe describes controls untouched).
- **Panel fold**: folds to a "TF" tab (title in tooltip, `aria-expanded=false`) and restores.

Do the tests verify what they claim? Yes — each case asserts on observable effects (panel text,
exposed wire objects, DOM state, listener flags, result notes) and each `ok` feeds the `failed`
counter and the process exit code. The panel-text probes are regex-based over concatenated
`textContent` (`/question found\s*yes/` etc.); the key/value spans concatenate without
whitespace, which `\s*` tolerates, and a false positive would require those phrases to appear
elsewhere in the panel, which they do not. The harness deliberately does not cover the live
page's real DOM (stated in its SPEC) nor the worker half — background.js is entirely untested
here, which is where the real races live (see background.BUG-ANALYSIS.md), but that is a scope
decision recorded in the SPEC, not a defect of this file.

## Functions (low-level)

- **jsdom resolution (L18-19)** — resolves `jsdom` through `../framework`'s dependencies since
  this directory has no package.json; fails loudly if the repo install is missing. Correct.
- **Fixture builders (L21-67)** — `block`/`wideBlock`/`highlighted` (escaping `<` in the
  highlighted variant), `esc` for the spec/example blocks (escapes `<`/`>` so placeholders
  survive innerHTML), `row`/`feed` mirroring claude.ai's `transcript-row` markup. `block` itself
  is inserted un-escaped, but it contains no `<`, so nothing is lost. Correct.
- **Case table + runner (L69-130)** — builds each page (shadow case via `attachShadow`), evals the
  script, reads the panel from `documentElement`'s direct `div` children, computes
  `found`/`composerOk`/`titleOk`, counts failures. `titleOk` is only enforced for positive cases —
  intentional, negative pages have no title to show. One subtlety: `dom.window.eval(script)` runs
  the top-level panel render synchronously, so no waiting is needed; the mutation observer and the
  60s heartbeat are torn down by `dom.window.close()`. Correct.
- **Wire-shape block (L136-162)** — feeds a shaped block in turn 1 (with turn 0 as intro so the
  opening-turn exclusion is active) and compares `__tfBridgeQuestion` to the exact expected JSON,
  including key order via `JSON.stringify` — stable because both objects are built in source
  order. Correct.
- **`mirrorOf(body)` (L169-179)** — evals, grabs `__tfBridgeTranscript` and panel text, closes the
  dom. Correct.
- **Mirror cases (L181-217)** — expected prompt text is `prompt.trim().slice(0, 8000)`: matches
  `cleanText` (single line trimmed, then head-capped). The ` Copy` line pins glyph
  stripping and line-trimming. Tail-rendering and no-rows cases assert positions and the named
  panel state. Correct.
- **`deliver(body, prepare)` + delivery cases (L225-279)** — jsdom has no `execCommand`, so these
  exercise the fallback fill; the click case additionally asserts the composer text equals the
  answer, and the no-composer case shortens the wait. `deliver` returns the dom for the caller to
  close; every caller does. Correct.
- **Collapse case (L287-309)** — finds the toggle by `aria-expanded` (the other panel buttons
  carry none), asserts expanded → folded (title gone, "TF" present, aria state) → restored.
  Correct.
- **`newSessionPage(opts)` (L318-373)** — synthetic new-session page: remembered chip or select
  trigger, dialogs with `role=option` entries removed on pick, branch chip created after a repo
  pick, send handler pushes `/code/session_01NEW`, waits shortened via the `__tf*Ms` knobs.
  `seen.searched` records search input values. Entries stay in the DOM until picked, mirroring
  the live page's closed-picker behavior closely enough for `usable` (no `checkVisibility` in
  jsdom — treated as visible, which the content script documents as the intended degradation).
  Correct.
- **Creation cases (L377-446)** — remembered/other/none remembered, glyph labels, wrong branch
  (asserts `!seen.sent`), missing picker + probe. The wrong-branch case is the safety-critical
  pin: nothing is sent when the branch list lacks the ref. Correct.
- **Exit (L448-449)** — prints and exits non-zero on failure. Correct.

## Bugs found

None found.
