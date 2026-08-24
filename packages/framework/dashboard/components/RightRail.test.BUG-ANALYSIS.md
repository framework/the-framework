# Bug analysis: packages/framework/dashboard/components/RightRail.test.tsx

## Business logic (high-level)

Four describe blocks pinning: the fixed rail width (`w-[22rem]`) across tab shapes and after the
first-view auto-jump; the Browser tab's #1053 gating (offered for a local run with the flag,
never for `target="actions"`); tab hover help; `docsInMain` (tab withheld AND `onDocs` never
called, rail absent when Docs was the only tab, session views keep the tab); and the
earned-content rules (no docs → no tab → no rail when nothing else; a live surface keeps the rail
on empty reads; tabs hold while the first read is out; the open tab losing its content falls back
to one that still has content, after an explicit hand pick).

Seams: `onDocs` mocked at the rpc module; DocsPanel/FileTree/BrowserPanel stubbed (their own
suites cover them); ViewsRail rendered for real. `beforeEach` resets `onDocs` to resolve one doc
so the Docs tab is earned by default; `afterEach(cleanup)` clears the 4s poll via unmount.

Verification quality:

- `settle()` (two awaited microtask turns inside `act`) flushes the mocked `onDocs` resolution —
  correct for promise-based updates with no timers involved.
- The "skips its read" assertion (`onDocs` not called) genuinely pins the `null`-load path, not
  just the hidden tab.
- The blink test uses a never-resolving promise — exactly the "first read still out" state — and
  asserts the tab is present without settling. Correct.
- The fallback test first *hand-picks* Views (so the auto-default is off — the fallback must come
  from the `active` computation, not the effect) and asserts `aria-selected` lands on Docs after
  views empty. This is the strongest of the suite: it distinguishes the two mechanisms.
- Width tests assert a class token; shallow, but the regression they pin (#862's per-tab wide
  mode) was a class change, so the assertion is the right level.

Coverage gaps (noted, not test bugs) — both align with the bugs filed against RightRail.tsx:
no test for `target="remote"` / `"web"` with `hasBrowser` (the dead-tab case), and no test that a
*newly selected agent's* first view pulls focus (the suite never changes `agentId`; the one
first-view pull it exercises is the mount-time one, via the width test's comment and the
"live surface" test's Views tab). A `views`-pull assertion on `aria-selected` after a rerender
from `views={[]}` to `views={[view]}` is also absent — the pull is only indirectly pinned.

## Functions (low-level)

### Module setup

`vi.hoisted` + `vi.mock` + top-level `await import` — correct ESM mock pattern; panel stubs
render sentinel divs. Correct.

### `baseProps` / `view`

Minimal but type-cast fixture (`as AgentView`) — fine for a display-only prop. `files: []` means
the Files tab is absent by default, so tests that need it pass `files={['a.ts']}` explicitly.
Correct.

### Individual tests

All queries are role-based (`tab` names via button text) and would throw on missing elements; the
tooltip test awaits `waitFor`; the two async describes settle before asserting absence, so a
pending resolution cannot fake a pass ("no docs, no Docs tab" would fail if the tab lingered).
The Actions-gating pair proves both polarity directions of `showBrowser`'s one implemented
exclusion. Verdict: correct.

## Bugs found

None found (coverage gaps for the two RightRail.tsx bugs are recorded above; the existing tests
assert true things).
