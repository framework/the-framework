The built-in prompt bodies — the actual wording of every check the default loop policy dispatches, written for the flagship Vike + universal-orm stack and shipped as editable markdown.

## TLDR

- The major-change chain: a thorough two-pass review (correctness, data layer, server/client boundaries, contracts, design), a code-quality pass (clarity and simplicity, explicitly not a bug hunt), and a security audit (authorization first — the classic hole is one user reaching another's rows).
- The UI-flow chain: a QA pass that actually drives the flow in a browser instead of reading code, and a UX review judging unhappy paths, feedback, forms, and accessibility.
- The production-grade checklist is the bootstrap's gate: it judges the whole app as it stands (auth, data scoping, error handling, instrumentation, email, validation, tests, build) and ends with the machine-readable blockers verdict — empty means production-grade.
- Standalone bodies round it out: a fast TLDR review, a strictly behavior-preserving refactor task, and a knowledge-base template that holds the project's standing business context rather than a task to run.
- Each body registers under the exact id the default policy references, so the loop resolves out of the box; a project overrides a check by supplying its own body under the same id.

## Rationales

- What a review checks for is the part non-experts in the engine are best placed to improve, so the bodies are prose a pull request can edit without touching code.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
