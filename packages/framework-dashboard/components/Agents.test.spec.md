Tests for `Agents.tsx` (#1139) — covers listing working sessions with no Current/Recent split, the click opening the session (project + run), empty vs loading states, and the label fallback for a session with no intent.

## Facts

- Pins the #1189 regression (an Overview row must open the session, not the project launcher); the tests that previously held that line were deleted with `WorkingNow.tsx` in #1190.
- Everything renders from props, so the suite mocks nothing — no telefunc in the import graph.
