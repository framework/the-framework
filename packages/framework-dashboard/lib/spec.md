The dashboard's client-side library: pure logic modules plus thin React hooks that turn the daemon's Telefunc reads/streams into UI state — no components here, only what they consume.

## TLDR

- Read/write plumbing: `use-async.ts` (`useLoaded`/`usePolled`, the one guarded read pattern), `use-action.ts` (the mutation twin), `use-start-run.ts` (start + `busy` refusal), `use-runs.ts` (2s run list), `use-run-handoff.ts` (push/PR state), `use-working.ts` (cross-project "agent working"), `quota.ts` + `quota-bar.ts` (usage panel data + bar arithmetic), `editors.ts` (installed-editor picker).
- Live feed & run state: `use-live-events.ts` (per-run `events.jsonl` stream over a Telefunc Channel, reconnect + `lost`/`done`), `live-state.ts` (pure selectors: active/outcome/choice gate), `event-times.ts` (arrival-time side table), `run-status.ts` (the ranked status pill), `run-label.ts`, `status-tone.ts`, `event-labels.ts` (badge wording), `queue-entry.ts` (TODO_AGENTS.md line → readable row).
- Routing: `route.ts` (pure URL scheme `/`, `/{projectId}`, `/{projectId}/{runId}`, `/settings`, tickets routes) + `use-route.ts` (Vike-router-backed route-as-state, #784).
- Preferences & run options: `preferences.ts` (global + per-project preference stores), `run-option-rows.ts` (the one option table with cross-option rules, rendered by launcher and settings), `use-context-set.ts` (run Context path set).
- Multi-device (#1052/#1066/#1067/#1072): `profiles.ts` (saved daemon connections in localStorage), `remote-target.ts` (selected run-target device, in-memory), `draft-handoff.ts` (composer draft carried across a device hop), `use-device-status.ts` (online/offline dots).
- Notifications & attention: `use-notifications.ts` (browser notifications for the needs-you and activity feeds, #627), `notification-permission.ts`, `notify-channels.ts` (what the daemon can deliver on), `document-title.ts` (needs-you count in the tab title), `favicon.ts` (animated mark while working).
- Health: `use-daemon-health.ts` (5s liveness probe, #948).
- Presentation helpers: `format-date.ts` (all timestamp display, "Invalid Date"-proof #759), `ticket-priority.ts`, `ticket-filter.ts` (the /tickets filter/sort/group model + URL codec, #1144), `session-link.ts`, `resume-command.ts` (#1195 terminal resume one-liner).
- Generic React utils: `get-strict-context.tsx`, `use-mobile.ts`, `utils.ts` (`cn`).
- Tests colocated as `*.test.ts(x)` (vitest + @testing-library/react); telefunc modules mocked via `vi.hoisted` + dynamic import.

## Decisions

- Layering rule: logic that can be pure is pure (route, run-option-rows, live-state, quota-bar, format-date, queue-entry, resume-command…) — testable without a DOM, wrapped by thin hooks; shared single tables/selectors exist precisely so two rendering surfaces (launcher vs settings, toolbar vs overview, client vs daemon notifier) cannot drift.
- Failure posture (#948): polled reads keep their last value on failure (a blank panel would lie), the live channel retries with backoff, and `use-daemon-health.ts` is the one place that turns "unreachable" into a visible fact.
- Per-browser secrets stay in the browser: device tokens live in localStorage (`profiles.ts`) or in memory (`remote-target.ts`), never in daemon-side Preferences; the daemon is handed `{id, url, token}` per call when it must act on a device.
- Prerender-safe by construction: the shell is one static index.html (ssr:false), so every hook resolves to a safe default (null/false/empty) without `window` or a daemon and fills in client-side.

## Facts

- The dashboard is a projection of the selected run's `.the-framework/events.jsonl`: `use-live-events.ts` streams it (one `FrameworkEvent` per line, per-run since #736/#749), everything else is polled telefunc reads from `../server/*.telefunc.js`.
- `FrameworkEvent` carries no timestamp; `event-times.ts` stamps arrival in a WeakMap side table so the framework's type stays untouched and replayed events simply show no times.
- The `@gemstack/the-framework/client` entry supplies the shared client-safe logic (event selectors, option defaults, notification identity keys) — importing from the package root would drag Node code into the SPA bundle.
