Tests for the four shipped non-software domain presets (web-development, data-science, product-management, biological-science) — pure `.md` content auto-discovered by `builtinDomainPresets()`; these guard their shape.

## TLDR

- Each preset loads with the expected title, a non-empty description, exactly 2 loops, and ≥5 prompts.
- Loops target the non-web event kinds `major-change` + `bug-fix`; every id a loop dispatches resolves to a shipped, non-empty prompt body.
- Every major-change review prompt carries a `"blockers"` verdict footer so the loop can gate.
- Loading with `modes: ['technical']` (Technical Control) replaces the major-change chain with a leaner single-prompt variant without adding loops.
