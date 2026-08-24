# Bug analysis: packages/framework/dashboard/components/RightRail.tsx

## Business logic (high-level)

The right sidebar's tab logic (#314/#1146/#1455): four content-earned tabs (Files, Views,
Browser, Docs), a focus rule (only the first published document pulls; a hand pick stops the
auto-default), a default (Files if files, else Docs), a content-loss fallback, counts, and the
docs poll owned by the rail. Checked against the SPEC:

- **Earned tabs / no rail**: `tabs` built from `hasFiles`, `hasViews`, `showBrowser && agentId`,
  `hasDocs`; order Files→Views→Browser→Docs matches SPEC; `!projectId` and `tabs.length === 0`
  render nothing. Holds — with one exception for Browser on non-local targets (bug 1).
- **First document pulls focus, nothing else**: the effect jumps to `views` only when `hasViews`
  flips while `sawView` is false; the auto-default (`files`/`docs`) applies only `!touched &&
  !hasViews`; `pickTab` sets `touched` forever. Holds within one selected agent — but `sawView`
  is never reset when `agentId` changes and the component is mounted un-keyed in App.tsx, so it
  leaks across agents (bug 2).
- **Default until then**: `setTab(hasFiles ? 'files' : 'docs')` in the effect's else-branch, re-
  evaluated as files arrive. Holds.
- **Content-loss fallback**: `active = tabs.includes(tab) ? tab : tabs[0]` — pure fallback that
  also restores the remembered tab if its content returns. Holds (pinned by test).
- **Counts**: Views badge = `views.length`; Files badge counts only tree files present in the
  context (`files.filter(f => context.has(f))`), excluding whole-repo entries per SPEC. Holds.
- **Docs read for the whole rail**: polled every 4s keyed on `[projectId, docsInMain]`; tab kept
  while `!docsLoaded` (no blink on project switch); with `docsInMain` the tab is withheld AND the
  poll skipped (`null` load). All per SPEC and pinned by tests.

## Functions (low-level)

### `TABS`

Labels + hover help texts; wording matches the SPEC's tab explanations. Correct.

### `RightRail(props)`

- Docs poll: `usePolled(projectId && !docsInMain ? () => onDocs(projectId) : null, [], 4000,
  [projectId, docsInMain])` — load closes over exactly its deps; cleanup stops the interval;
  stale-project answers dropped by the hook's token. Correct.
- `hasDocs = !docsInMain && (!docsLoaded || docs.length > 0)` — "hidden only once we KNOW".
  Correct.
- Focus effect: deps `[hasViews, hasFiles]`. Mount with pre-existing views jumps to Views
  (deliberate — the width test's comment relies on it). Views dropping to zero with `!touched`
  re-defaults. Correct except the cross-agent leak (bug 2).
- Tab list rendering: `role=tablist`/`role=tab`/`aria-selected`; count badge only when > 0;
  tooltips per tab. Correct.
- Panel switch: each armed branch re-checks its content guard; the final else is DocsPanel, which
  receives `loaded` so the not-yet-known state shows "Loading…" rather than "No docs". Correct.
- `selectedFiles` recomputed per render from the live `context` Set — no staleness. Correct.

## Bugs found

1. `L85` (`showBrowser = hasBrowser && target !== 'actions'`): the Browser tab is offered for a
   **remote-device agent**, where it can only ever be a dead panel. Chain verified: a remote
   start forwards the user's options to the device (daemon-runtime.ts `options.remote` branch);
   the device's agent emits its browser-bridge event; `RelayedAgents.apply` folds relayed events
   into the local stub via the store's own reducer, which sets `browserStreamPort`
   (store/agent-store.ts); App.tsx then computes `hasBrowser = running && browserStreamPort !==
   undefined` and passes `target='remote'` — and this guard only excludes `'actions'`. Clicking
   the tab mounts BrowserPanel, whose proxy lookup reads *local* live metas
   (dashboard/browser-proxy.ts `defaultBrowserPortLookup`); the relayed stub is memory-only and
   never on disk, so every request 404s ("no browser preview for this run") — a permanently
   broken pane. This contradicts the SPEC's TL;DR ("Browser only when the agent is actually
   serving a preview") and rationale ("the browser tab is withheld unless the agent genuinely
   has a preview to show"), this prop's own JSDoc ("`remote` (#1067) has none locally either,
   and neither does a `web` cloud session"), and RemoteAgentNotice's promise that the preview is
   "not available for remote runs yet". Severity: minor. Fix: exclude the non-local targets —
   e.g. `const showBrowser = hasBrowser && (target === undefined || target === 'local')`.
2. `L91-98` (`sawView` ref): the first-document focus pull is once per rail lifetime, not once
   per agent. The rail is mounted un-keyed in App.tsx, so after any selected agent has had views
   (`sawView.current = true`), switching to a different agent that later publishes *its* first
   document does not pull the rail to Views — the SPEC's "the rail switches itself to Views the
   moment the agent publishes its first document" (and the user story "a document the agent
   published mid-work should surface by itself") silently stops working for every agent after
   the first. Scenario: open agent A with a plan view, switch to fresh agent B, B publishes its
   summary — the rail stays on Files and the user never learns the document exists. Severity:
   minor. Confidence: the mechanism is certain; per-agent intent is the natural SPEC reading.
   Fix: reset `sawView.current` (to the new agent's current `hasViews`) in an effect keyed on
   `agentId`.
