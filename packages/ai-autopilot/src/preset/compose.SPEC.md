Merges several domain presets into one under a new label, so a broader preset is simply the composition of narrower ones — presets-of-presets falls out for free.

## TLDR

- Check chains from all parts are kept side by side; overlap is harmless because duplicate checks are dropped when a change fires them.
- Prompt bodies merge by id with the later preset winning, so a preset can reword a shared check by coming after it.
- The last declared default change kind carries through, and the merge is itself a preset, so composition nests.
- Picking a preset by name from a set (the user's chosen domain) lives here too.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
