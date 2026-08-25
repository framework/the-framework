# Bug analysis: packages/framework/dashboard/components/AgentChanges.tsx

## Business logic (high-level)

The live agent's changed-files panel (#817/#1023): polls `onAgentChanges(projectId, agentId)`
every 8s (worktree-derived — `git status` + `numstat` — the outcome, not the agent's stated
intent), lists each file (directory dimmed, deleted names struck through, new/modified/deleted
tone, `DiffStat` unless binary), expands a row into `FilePreviewCard` which fetches the diff only
then, and reports the running totals upward through `onSummary` so the action bar can show
"N files · +A −R" while the section is collapsed. Contract notes carried in the code and SPEC:

- **Caller-owned precondition** — `agentId` required, and the caller must render this only while
  the agent's worktree exists; otherwise `resolveAgentPath` falls back to the project root and
  the panel would present the user's own uncommitted files as the agent's. The component cannot
  enforce this itself (documented reliance on the caller; AgentView owns the gate).
- **Keeps polling while collapsed** — `open` only gates rendering (`return null`), not the poll
  or the summary effect; the SPEC wants exactly that ("keeps refreshing even while collapsed,
  because the file count is the reason to open it"). Holds.
- **Nothing to show, nothing shown** — empty list (or `!open`) renders nothing; the summary
  effect still reports `(0, 0, 0)` so the bar drops its disclosure. Holds.
- **Failure tolerance** — a rejected poll keeps the last value (`usePolled` swallows), so a
  daemon hiccup leaves the panel silent rather than erroring; the SPEC's tests pin this.

Edge cases and ordering: switching agents resets the poll to the empty initial, so the summary
flashes `(0,0,0)` before the new agent's numbers land — cosmetic, consistent with the app's
switch-shows-nothing convention. The summary effect deps are `[changes.length, added, removed]`;
a poll answer that changes *which* files are listed while keeping the same count and totals
would not re-fire `onSummary`, but the numbers it reports would be identical anyway — no
observable difference. `onSummary` is routed through a ref (`report.current = onSummary` each
render) so inline callbacks do not re-fire the effect; the render-time ref write is the standard
latest-callback pattern and safe here. Row expansion state lives per `ChangeRow` keyed by
`change.path`, so a file that disappears from the list drops its expansion (correct — the diff
would be gone too), and a re-appearing path starts collapsed.

## Functions (low-level)

- **`LABEL` / `TONE` (L24-34)** — exhaustive over `FileChange['status']`
  (untracked/modified/deleted); a new status would be a type error, not a runtime hole. Correct.
- **`ChangeRow({projectId, agentId, change})` (L36-68)** — local `open` state; dir/name split on
  the last `/` (a root-level file yields an empty dir span — fine); `aria-expanded`; chevron
  rotation; deleted strikethrough on the *name* only (dir remains readable — intended per the
  SPEC's "a deleted file's name struck through"); `DiffStat` suppressed for binary; the preview
  is mounted only while open so the diff RPC is paid on demand (SPEC). Correct.
- **`ChangesSummary({count, added, removed})` (L71-81)** — null at zero, singular/plural
  "file(s)", `DiffStat` for the totals. Pure. Correct.
- **`AgentChanges({projectId, agentId, open, onSummary})` (L92-131)** — poll wiring (deps match
  the closure), totals via two reduces (binary files contribute their `added`/`removed` fields,
  which the read reports as 0 for binaries — consistent with the bar's line totals), ref-routed
  summary effect, and the two early-return conditions ordered so the summary still reports while
  hidden. The `max-h-80 overflow-auto` list keeps a forty-file session scrollable inside the
  pane rather than pushing the feed down. Verdict: correct.

## Bugs found

None found.
