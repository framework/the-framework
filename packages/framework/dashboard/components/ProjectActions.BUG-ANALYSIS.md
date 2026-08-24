# Bug analysis: packages/framework/dashboard/components/ProjectActions.tsx

## Business logic (high-level)

A one-component layout file: the project home's action bar (#488). Per SPEC, it must show the
project's git status on the left and the workspace actions on the right, and both halves must be
the same components an agent's bar uses so the two pages cannot drift — with no session passed, so
they act on the project's own checkout.

Verified against the shared components' contracts:

- `GitStatusBar` accepts `agentId?: string | null | undefined` ("absent reports the project's
  checkout") — passing only `projectId` + `inline` is exactly the project-checkout mode.
- `WorkspaceActions` likewise: "The session to act on; absent acts on the project's checkout".

So the SPEC's "passes no session" contract is honored; there is no logic here that could fail —
no state, no effects, no handlers. The `min-w-0 flex-1` spacer pushes the actions right and lets
the status bar truncate on narrow widths; `flex-wrap` keeps the bar usable when both halves cannot
fit on one line.

## Functions (low-level)

### `ProjectActions({ projectId })`

Pure layout wrapper. Inputs: `projectId` (always a valid project id — rendered only inside a
project page). Output: a bordered flex row with `GitStatusBar` (inline mode) and
`WorkspaceActions`. Edge cases: none reachable — no conditionals, no data handling; failure modes
of loading/actions live inside the two children and are analyzed with those files.

Verdict: correct.

## Bugs found

None found.
