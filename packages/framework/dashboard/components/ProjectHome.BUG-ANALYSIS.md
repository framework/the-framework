# Bug analysis: packages/framework/dashboard/components/ProjectHome.tsx

## Business logic (high-level)

The project home / launcher page: pure composition of the sections its SPEC orders. Checked
against the SPEC point by point:

- **The launching pad stays put**: this component holds no started-agent state; starting flows
  through `onAgentStarted` up to the shell, which opens the agent view alongside. Nothing here
  unmounts on start. Holds.
- **Problems before actions**: render order is `ProjectActions` → `ProjectErrorBanner` →
  `StartAgentForm` — the banner sits exactly "between the project's action bar and the start
  form" as the detailed SPEC requires. Holds.
- **What is running right now**: `{events.length > 0 && <AgentOverview events={events} />}` —
  the overview appears only once the project has activity; AgentOverview additionally
  self-hides when the events yield nothing presentable (double guard, harmless). Holds.
- **Every parked agent, answerable here**: `OpenQuestions` is rendered unconditionally with
  `onOpenAgent` (which per its type can target another project); the section hides itself when
  empty. Holds.
- **PLAN/TODO last, only when present**: `ProjectDocs` is the final section and self-hides. Holds.
- **The whole column scrolls**: everything is inside one `ScrollArea min-h-0 flex-1`; no nested
  scroller is introduced here (ProjectDocs' internal max-height scroller is a deliberate SPEC'd
  exception in that component). Holds.

Prop plumbing verified against child signatures: `StartAgentForm` receives exactly its seven
props; `onAgentStarted`'s 3-arg shape (`intent, agentId?, runsOn?`) matches (#1169's regression —
dropping the agent id — cannot recur here since the prop is passed through untouched);
`OpenQuestions` takes only `onOpenAgent`; `ProjectErrorBanner` accepts `errors` possibly
undefined, which is why `errors` being optional here is safe.

Concurrency/lifecycle: no state, no effects; children own their polls and clean them up
themselves. Nothing to leak or race at this level.

## Functions (low-level)

### `ProjectHome({...})`

Layout-only component; all inputs forwarded verbatim. Edge cases:

- `errors` undefined → banner renders null (guarded downstream). Correct.
- `events` empty → no AgentOverview, and the guard also avoids mounting a component whose
  projections would all be empty. Correct.
- `onAgentStarted` optional and forwarded as-is — StartAgentForm's type accepts the same
  optionality. Correct.
- Switching projects: `projectId` changes propagate into ProjectActions/StartAgentForm/
  ProjectDocs; each child keys its own reads on the id. No stale-project state held here.

Verdict: correct.

## Bugs found

None found.
