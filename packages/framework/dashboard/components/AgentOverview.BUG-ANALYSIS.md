# Bug analysis: packages/framework/dashboard/components/AgentOverview.tsx

## Business logic (high-level)

Stateless at-a-glance strip above a feed (rendered by `ProjectHome` when the project has
events): status pill + session name, error count with latest headline, session deep link.
Checked against `AgentOverview.SPEC.md`:

- **Each part appears only once its fact arrived; all absent → render nothing** — the
  `!sessionLink && !status && errors.length === 0 → null` guard plus per-part conditionals. ✓
  (`agentStatusPill` is null until the agent has a name/state/ending, `describeSessionLink`
  null until a deep link exists, errors empty until one lands.)
- **Errors: count kept here, rows stay in the log** — delegates to `AgentErrorCount` with
  `headline`. ✓
- **Session link labelled for what it opens** — partially: `describeSessionLink` only ever
  returns a *per-session* deep link ("Open session (id) ↗") and returns null for the generic
  app entry — it never "offers the driver's app", which both this SPEC and this file's own
  comment (L19-21: "the generic app entry (claude.ai/code) is shown as 'Open Claude Code'
  with the id surfaced separately") say it should. See bug 1 (cross-file: the behavior lives
  in `dashboard/lib/session-link.ts`).

Data-shape checks: `sessionInfo`/`agentProgress`/`agentErrors`/`agentStatusPill` all
total functions over the events array (empty → null/empty), so no reachable crash. The
status row shows the dot+label even when `progress.sessionName` is absent (name conditionally
rendered inside) — consistent with "each part appears only once its fact has arrived". The
link opens in a new tab with `rel="noreferrer"` — no window.opener leak. No state, effects, or
subscriptions.

One structural note: `errors.length > 0` gates a wrapper around `AgentErrorCount`, which
re-checks the same condition internally — harmless duplication that prevents an empty wrapper
div from adding grid gap. Fine.

## Functions (low-level)

- **`AgentOverview({ events })` (L13)** — inputs: the (possibly foreign-project-scoped) live
  feed; outputs: the strip or null. Folds are all linear scans; recomputed per render, cheap.
  Edge cases: empty events → all folds empty → null ✓; a failed agent's pill carries
  `failed — <detail>` with danger tones (from `agentStatusPill`, ranked ending-over-progress)
  ✓; the grid gives every child `md:col-span-2`, so the two-column template is inert — layout
  quirk, not behavior. Verdict: correct except the delegated link behavior (bug 1).

## Bugs found

1. **Cross-file (fix in `packages/framework/dashboard/lib/session-link.ts` L27, or this SPEC):
   the generic session link is dropped instead of being offered as the driver's app.** Scenario:
   a headless Claude run records the default generic `claude.ai/code` session link (a literal
   `sessionLink` with no `{sessionId}`); `describeSessionLink` returns null for any href that
   does not embed the session id, so the overview shows no link at all — while
   `AgentOverview.SPEC.md` says "where the driver has no per-session address, it offers the
   driver's app rather than pretending to be a deep link to that session", and this component's
   own JSDoc describes the same "Open Claude Code" fallback. Severity: minor. Confidence: low —
   `session-link.ts`'s header comment deliberately argues the generic entry "isn't worth an
   action", so either the lib regressed against the SPEC or the SPEC and this file's comment
   are both stale; the orchestrator should decide which document wins. Fix sketch: have
   `describeSessionLink` return `{ href, label: 'Open <driver> ↗' }` for a literal link (id
   shown separately), or update the SPEC + comment to the show-nothing rule.
