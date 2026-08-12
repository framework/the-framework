Collapses a family of related capabilities into one tool the model calls with a selector field, so small models see one call instead of many.

## TLDR

- Each capability declares its own input and handler; the advertised schema is one flat object holding the union of all fields plus a selector listing the callable capabilities.
- Only fields every capability needs are required up front; each capability's own requirements are enforced in code right before its handler runs, and fields used by only some capabilities are annotated so the model knows when they apply.
- An allowlist can narrow the callable capabilities (e.g. per-plan gating) — both the advertised choices and the runtime dispatch honor it, and naming an undeclared capability fails at build time.
- Handlers may stream progress like any server tool.

## Rationales

- Function-calling APIs don't reliably honor schema unions, so a discriminated union must flatten into one object with a selector, with per-branch strictness moved into code.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
