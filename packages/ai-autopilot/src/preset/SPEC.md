Domain presets — the selectable bundle of quality discipline for a domain of work, tying together which follow-up checks fire after which kind of change and the wording of those checks.

## TLDR

- A preset is a named {loops, prompts} bundle: pick Data Science and every substantial change gets reproducibility, data-validation, and methodology review, while every bug fix gets root-cause and regression-test follow-up.
- There are three ways to get one: author it in code, load it from a folder of markdown files (the no-code, shippable form the built-ins use), or compose several into one — and a composed preset is itself a preset, so presets-of-presets nests naturally.
- When presets merge, their check chains accumulate and same-id prompt wording is overridden by the later preset.
- Content adapts to working modes: a file can ship mode variants, and the most specific variant whose modes are all active replaces the base — Technical Control, for example, gets leaner chains because the developer drives the depth themselves.

## Rationales

- Presets are data, not code: a folder of markdown is something a domain expert, the community, or a marketplace can ship and improve without touching the engine.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
