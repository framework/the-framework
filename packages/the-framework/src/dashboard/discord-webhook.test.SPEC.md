What the tests cover: a message over Discord's 2000-character limit is clamped before posting, with the cut visibly marked as truncated; a rejected post resolves as "not delivered" rather than passing as delivered; a network error also resolves as "not delivered" rather than throwing out of a watcher; and a realistically long "needs you" batch of interventions goes through clamped instead of silently posting nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
