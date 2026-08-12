Loads a domain preset from a folder of markdown files — the no-code form that lets anyone author or ship a preset without touching the engine.

## TLDR

- A preset folder is a manifest (name, pitch, optional default change kind) plus two optional subfolders: the loops saying what fires after which kind of change, and the prompt bodies they run.
- Whole collections are discovered too: every subfolder holding a manifest is a preset — that is how the shipped built-ins are found and how a picker enumerates them.
- The active modes are applied while loading, so mode variants replace their base files before the preset is assembled.
- A folder without a manifest is not a preset: loading one directly fails loudly, and collection scanning skips it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
