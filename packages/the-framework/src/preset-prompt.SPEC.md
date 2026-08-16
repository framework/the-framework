How a preset is defined: only what actually differs between presets (name, prompt, what its one target means) is declared; parameter handling, defaults, and rendering are shared.

## TLDR

- A preset either takes one target ("what to run against") or scopes itself, in which case its prompt is used verbatim.
- A blank or omitted target falls back to a dynamic default: the agent the preset was launched from, else the whole codebase.
- Rendering never throws on missing context — a preset previewed before any agent exists simply falls through to the codebase-wide default.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
