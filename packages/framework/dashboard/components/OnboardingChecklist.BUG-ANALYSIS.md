# Bug analysis: packages/framework/dashboard/components/OnboardingChecklist.tsx

## Business logic (high-level)

The Onboarding card (#958): five steps, each `done` derived from an observed fact — never
clickable-to-tick — with the action shown only while undone, an Optional mark on the three
skippable steps (marked per step, not by position, per the SPEC's reorder rationale), a
progress count, a dismiss control only when `dismissible` (Overview), and live re-reads
(dashboard 10s, suggestion 30s, channels via the shared store, permission via the polling hook).

Step-by-step verification against `OnboardingChecklist.SPEC.md`:

- **Add a project**: `done = totals.projects > 0`; offers "Add <cwd> as project" only when the
  daemon's cwd exists and is not already registered (`suggestion?.cwd && !suggestion.cwdProjectId`),
  plus the folder-picker dialog always; `addCwd` reports failure in place (including a
  daemon-unreachable catch) and reloads both reads on success. Correct.
- **Populate the queue**: `done = openTodos > 0`, no action (SPEC: filled by the agent/user).
  Correct.
- **Populate tickets/** (optional): `done = any project hasTickets`; "Update from GitHub" starts
  the `updateTickets` preset unattended (#1279) on `targetProjectId` and hands
  `(projectId, intent, started.agentId)` up so the shell lands on the import (#1169); a start
  that succeeds without an id still hands the project up (agentId undefined — the test SPEC's
  "shell adopts the running agent" case); a refusal (`start` → undefined) navigates nowhere and
  `startError` renders in place. Disabled with no target, with the "Add a project first" hint.
  Correct.
- **Browser notifications** (optional): `done = permission granted AND preference on`; Enable
  writes the preference and requests permission riding the click (only when `'default'`);
  denied/unsupported render the explanatory spans instead of the button (so the unguarded
  `Notification` access in the handler is unreachable when the global is missing). Correct.
- **Discord** (optional): `done = channels?.discordWebhook ?? false`; button opens
  `DiscordWebhookDialog`, whose `onSaved` is `reloadNotifyChannels` — the shared store then ticks
  this row, the settings rows, and the bell together (#1095). While `channels` is null (first
  read in flight) the row briefly reads not-done; unlike the bell there is no SPEC'd no-flicker
  promise here, and the module-scoped cache makes it a first-paint-only artifact. Noted, not a
  bug.
- **Target project**: `suggestion?.cwdProjectId ?? data?.projects[0]?.projectId ?? null` —
  matches the SPEC's "daemon's own directory when registered, else the only/most recent";
  whether `projects[0]` is "most recent" is the server's ordering contract (reliance noted).
- **Dismiss**: writes `onboardingDismissed: true`; control only under `dismissible`; the
  aria-label states the resume-on-settings promise. Correct.

Async/lifecycle: `addCwd` awaits, clears busy, then reloads; a mid-flight unmount leaves only
harmless setState-on-unmounted (React 18 no-ops). `usePolled` loads close over nothing (deps
`[]`) per the hook contract. `populateTickets` early-returns without a target (button disabled
anyway). No leaks; dialogs are controlled.

## Functions (low-level)

- `OnboardingChecklist({dismissible=false, onAgentStarted})`: composition as above. The
  `onAgentStarted` prop is required by design so a new mounting surface cannot drop navigation.
  Correct.
- `addCwd()`: guard, busy flag, catch-to-error-shape, error-or-reload. Correct.
- `enableBrowserNotifications()`: preference write + conditional prompt. Correct.
- `populateTickets()`: guard, unattended start, conditional hand-up (undefined id passes
  through, refusal keeps you here). Correct.
- `steps` construction + `doneCount`: five rows, three `optional: true`; actions hidden when
  done (`!step.done && step.action`). Correct.
- Render: header count "n of 5", dismiss tooltip/button, checkbox icons with
  `aria-label="Done"/"Not done"` (deliberately squares, not circles, #1139), struck-through done
  labels, `AddProjectPanel` (conditional, reload-on-added) and `DiscordWebhookDialog`
  (controlled, shared channels). Correct.

## Bugs found

None found.
