# Bug analysis: packages/framework/dashboard/components/TicketsPanel.tsx

## Business logic (high-level)

Two exports: `TicketRow` (the shared one-liner used by the panel and the page's flat list) and
`TicketsPanel` (one project's list with the GitHub-update bar and the empty/filtered states), plus
the exported `workOnTicketPrompt` ask.

Panel invariants (checked against the SPEC-bearing comments and sibling specs — this file has no
`.SPEC.md` of its own; `TicketsPage.SPEC.md` and the test file define most of its intent):

- **Prompt single-sourcing (#1187/#697)** — `UPDATE_PROMPT` is the preset's own render (module
  scope, once); `planTicketPrompt` comes from `src/client.js`; `workOnTicketPrompt` is exported so
  the test pins the exact ask. No hidden second copies. Correct.
- **Attended vs unattended** — update: `{ unattended: true }` (routine work, ends at settle);
  plan: attended (a per-ticket plan is a conversation, rationale in-line); work:
  `{ unattended: true, ticket: 'tickets/<file>' }` (#1117 meta naming). Matches the tests and the
  flat-mode twins in TicketsPage (verified byte-identical options).
- **States** — `!projectId` → null (hooks run first, order stable); `!loaded` → Loading;
  empty + `hiddenByFilter > 0` → "N hidden" + optional Clear (no import offer — #1230's rule);
  empty → import/update offer with error surface; filled → stamp row + update button + rows.
  All pinned by tests.
- **Stamp (#1208)** — `onTicketsMeta` read per panel (`useLoaded`, `NO_META` captured once so the
  dep-compare doesn't churn); `lastImportedAt` → relative wording, else "No record of an import
  yet"; tooltip wording differs by state. Correct.
- **`onAgentStarted(prompt, agentId)`** — called only on `ok`, letting the page jump to the
  session (#948/#1169). Correct.

`TicketRow` invariants:

- Every interactive control (checkbox, start, topic buttons, claim marker, plan cell, GitHub link)
  is a **sibling** of the open button, never nested (invalid-HTML rule stated in comments) —
  verified in the JSX structure; clicking any of them cannot bubble into `onOpen` since they are
  not descendants of it.
- Optional-handler pattern: no `onToggleSelect` → no checkbox; no `onTopicClick` → plain badges;
  no `onClaimedClick` → non-clickable claim span; no `onOpenPlan` → planned-cell button disabled.
  All correct and test-pinned.
- Checkbox never disabled (selection is page state, not an action) — matches the page SPEC.
- `busy` disables only the session-starting buttons (start column, create-plan). Correct.
- Meta columns: fixed widths for priority/date/plan/github keep alignment; the github-less row
  renders an equal-width spacer. Priority cell renders even when empty (alignment). `formatAge` +
  exact `title`. Topics keyed by topic string — duplicate topics in one ticket's frontmatter
  (`topics: [dx, dx]`) would collide keys; the parser does not dedupe, but React only warns and
  renders both — cosmetic, not reported.
- `locked`/`lockedBy` — hammer + truncated inline holder + tooltip with full id and planning-or-
  implementing wording. Correct.

Edge cases: `tickets` rows keyed by `ticket.file` — unique within one project's `tickets/` dir by
construction. `useAction` shared across the panel's three starts — one in flight at a time, all
buttons disabled together; fine. A failed start's error renders in both the empty state and the
filled state (above the stamp bar). The panel polls nothing itself — the caller owns list
freshness; `onTicketsMeta` is read once per project id, so the stamp can go stale after an update
session finishes — it refreshes on remount/section re-render when `projectId` changes only; noted
as a small staleness (the update session takes minutes and the page is typically left; not
contrary to any stated intent, not reported).

## Functions (low-level)

- **`workOnTicketPrompt(file)`** — fixed sentence naming `tickets/<file>`; exported for the test.
  Correct.
- **`TicketRow(props)`** — as analyzed above; purely presentational; no state. Correct.
- **`TicketsPanel(props)`** — `startSession(prompt, failure, options)` wraps
  `sendStart(projectId, prompt, 'prompt', options)` through `useAction` and reports
  `onAgentStarted` on success; the three wrappers pass the documented options. Hook order is
  stable (both hooks precede the early returns). Correct.

## Bugs found

None found. (The uppercase-topic click-to-filter bug manifests through this row's
`onTopicClick(topic)` raw pass-through, but the row is right to report the topic as displayed —
the normalization belongs to the filter owner, TicketsPage, where it is reported.)
