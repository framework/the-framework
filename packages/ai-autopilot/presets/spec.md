The five shipped domain presets — software-development, web-development, data-science, biological-science, product-management — each a directory of markdown: `preset.md` + `loops/` + `prompts/`.

## TLDR

- Uniform shape across all five: a `bug-fix` event runs `<domain>-root-cause` then `regression-test`; a `major-change` event runs three domain reviews. Each preset also ships `major-change.technical.md`, a mode variant that narrows the chain to the first (core) review — the developer is hands-on in technical mode, so the loop only auto-runs the essential gate.
- These markdown chains — not the code-authored default loops — are what the product actually runs when a domain preset is selected.

## Facts

- Review prompts end with the `{ "blockers": [...] }` verdict block; the root-cause and regression-test prompts deliberately do **not** — they are investigative/authoring steps, not gates.
- `regression-test` is a shared prompt id across all five presets with five different bodies — safe because presets are selected, not merged (composition merges by id, later wins).

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
