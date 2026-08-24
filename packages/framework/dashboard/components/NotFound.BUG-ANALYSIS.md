# Bug analysis: packages/framework/dashboard/components/NotFound.tsx

## Business logic (high-level)

The dead-link page (#784) per `NotFound.SPEC.md`: a bookmarked/pasted URL that no longer resolves
(worktree removed, project dropped) renders a headline, an explaining sentence, and exactly one
labelled action back to somewhere that exists — stated, never silently redirected. This component
is purely presentational: all four props are required, so a caller cannot render it without the
way-out button the SPEC mandates; what counts as "not found" and where the action goes are the
callers' logic (App routing), not this file's.

Edge cases: none applicable — no state, no effects, no async, no user input beyond the single
`onAction` click, and all content is caller-supplied plain text rendered by React (escaped).

## Functions (low-level)

- `NotFound({title, detail, actionLabel, onAction})`: centered column; `detail` width-capped at
  `max-w-md` for readability; outline `Button` wires `onAction` directly. No default props to get
  wrong, no conditional rendering to leave a dead end. Verdict: correct.

## Bugs found

None found.
