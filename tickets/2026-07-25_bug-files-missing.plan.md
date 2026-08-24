Effort: 2
Uncertainty: 3

# [Plan] Bug: `Files` missing

Make the Files rail tab distinguish "couldn't list the files" from "there are no files", instead of silently hiding in both cases.

## TLDR

The triage in the ticket is confirmed and the chain is fully mapped: every failure on the way to the file list collapses into `files: []`, and the rail hides any tab with no content (`RightRail.tsx:106`, principle #1146). The fix is to make "listing failed" a distinct value (`null`) end-to-end and render an error state for it, while keeping hide-on-empty for a genuinely empty answer — which reconciles the ticket with #1146 rather than fighting it. Small, self-contained; the sibling ticket #1140 (stale registry entry) stays separate and becomes diagnosable once this lands.

## Root cause (confirmed, with the full chain)

Every failure mode produces the same `[]` the UI treats as "no files":

1. `crawlRepoFiles` catches any `git ls-files` error → `[]` (`packages/framework/src/project.ts:150`). A moved/renamed project directory (#1140) lands here: git fails on the vanished cwd.
2. `withAgentPath` → unresolvable project/agent path, or a throwing read → `[]` (`packages/framework/src/dashboard-rpc/reads.ts:52-54`).
3. `relayOr` → unreachable relay → `[]` (`packages/framework/src/dashboard-rpc/relay-agent.ts:22-23`); a relay with no checkout answers `[]` by design.
4. Client: `useAsyncValue` swallows a rejected RPC and keeps the initial `[]`; it does expose `loaded`, but `App.tsx:97` destructures only `value`.
5. UI: `hasFiles = files.length > 0` (`RightRail.tsx:83`) → the tab is withheld (`RightRail.tsx:106`); `FileTree` itself renders nothing with no files (`FileTree.tsx:58`).

So a moved directory, a failed listing, a daemon hiccup, and a genuinely empty repo are pixel-identical: no tab.

There is already precedent for the fix in the same file: the Docs tab distinguishes "not yet loaded" via `hasDocs = !docsLoaded || docs.length > 0` (`RightRail.tsx:72`) so the rail doesn't blink on project switch.

## Problems

1. **What should each state render?** (uncertainty 3) The ticket says "show an empty/error state instead" of hiding — but the rail's design principle #1146 says a tab that can only say "nothing yet" is not offered, and on the relay an empty list is correct-by-design (no checkout there). Blindly always-showing the tab breaks both.
2. **The server swallows the signal.** (uncertainty 2) To tell "error" from "empty", the catch-to-`[]` at `project.ts:150`, `reads.ts:54` and `relay-agent.ts:23` must stop conflating them for this read. Conveniently, `git ls-files` on an existing-but-empty repo *succeeds* with zero entries and *fails* when the cwd is missing or not a repo — so error vs. empty is cleanly separable at the source.
3. **Transient flicker.** (uncertainty 2) The list is polled every 10s; one transiently failing poll would flip the tab into the error state and back.

## Solutions

Problem 1 — three options:

- **A. Always show the tab, empty state in the panel** (the ticket's literal suggestion). Rejected: violates #1146 for the relay/no-checkout case, where a permanently dead tab teaches people the panel is broken (same argument as the browser tab, `RightRail.tsx:108`).
- **B. Docs pattern only** (show while `!loaded`). Insufficient alone: `loaded` only covers client-side RPC failure; the server answers `[]` "successfully" for a vanished directory, so `loaded` goes true and the tab still hides.
- **C (recommended). Make "couldn't list" a first-class value (`null`) and render it as an error state; keep hiding on a genuine `[]`.** The two cases the ticket names (moved dir, failed listing) both become `null`; a truly empty listing still hides the tab, so #1146 is preserved, and the relay keeps answering `[]` (hidden by design there).

Problem 2 — follows from C: return `string[] | null` where `null` = "no listing" (git failure, unresolvable path, unreachable relay), `[]` = "listed, nothing there". Breaking the return type is fine (zero users; clean code preferred).

Problem 3 — two options:
- Keep last good value on a `null` answer and only show the error state when there was never a good value, or after N consecutive nulls. More state, hides real breakage for up to a poll cycle.
- **Accept the flip (recommended):** a server-side `null` is a definite answer, not a network hiccup (those are already absorbed by `useAsyncValue` keeping the last value), and a moved directory fails *every* poll, not one. Simplest honest behavior.

## Implementation

1. `crawlRepoFiles` (`project.ts`): return `null` instead of `[]` in the catch — type `Promise<string[] | null>`.
2. `onProjectFiles` (`dashboard-rpc/reads.ts`): thread `string[] | null` through; `withAgentPath`'s `empty` argument becomes `null` for this caller (unresolvable path = couldn't list). Keep `relayOr`'s relay-no-checkout answer `[]`; its *unreachable* fallback becomes `null`.
3. `App.tsx:97`: keep polling; normalize for the `#` context picker (which shares this read and should treat `null` as `[]`), pass both the list and a `filesError: files === null` (or the nullable value itself) down to `RightRail`.
4. `RightRail.tsx`: offer the tab when `files === null` too; when active in that state, render a small error note in place of the tree — e.g. "Couldn't list the project's files — has the directory been moved or removed?" — instead of `FileTree`. `hasFiles`/badge/count logic treats `null` as zero.
5. Tests:
   - `reads.test.ts:11` currently asserts unknown project → `[]`; flips to `null` (that *is* the distinction being introduced).
   - `RightRail.test.tsx`: tab present + error note when `files` is `null`; tab absent when `[]` (unchanged); tree when non-empty (unchanged).
6. FEATURES-SPEC.md: no change — this fixes existing behavior, adds no feature.

## Considerations

- **Relation to #1140** (`tickets/2026-07-25_removing-or-renaming-directory.md`): that ticket decides what the *registry* should do about a vanished path. This fix only makes the failure visible instead of silent — and is worth doing regardless, since the ticket notes fixing #1140 alone won't cover the failed-listing path. Land this first; it makes #1140 reproducible/diagnosable from the UI.
- The error-note copy shouldn't over-promise a cause: git failure and moved directory are indistinguishable at that point; "couldn't list" + the likely cause as a question is honest.
- `EMPTY_FILES` identity stability (`App.tsx:31`) must be kept when normalizing `null` for the picker (one stable `[]`, not a fresh array per render).
- The `files` docblock in `RightRail.tsx:47` ("empty on the relay") and the #1146 comment at `RightRail.tsx:103-104` should be updated to state the new tri-state contract.
- Fresh repo with zero files keeps a hidden tab (correct per #1146; not the ticket's complaint).
