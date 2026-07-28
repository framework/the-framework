The built-in loop policy as data: canonical event kinds (`LOOP_EVENTS`), canonical prompt ids (`LOOP_PROMPTS`), and `defaultLoops()` mapping kinds to prompt chains.

## TLDR

- `major-change` → `review`, `code-quality`, `security`; `ui-flow` → `qa`, `ux`; `production-check` → `production-grade`.
- `defaultLoops()` returns fresh arrays each call, so callers can safely extend or replace the policy.

## Facts

- The loop is prompt-source-agnostic: it only knows ids; the prompts library (#111) ships bodies registered under these ids so the default policy resolves (see `../prompts/`).
- `production-grade` is the checklist gate the bootstrap's full-fledged loop repeats against; its prompt returns a `{ blockers }` verdict. A comment notes the `loopChecklist` kind fires by default so the bootstrap gate resolves out of the box.
