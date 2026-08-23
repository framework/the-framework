What the tests cover: a `web`-target agent's agent meta ends up carrying the cloud session's real deep link (the per-session claude.ai/code URL the driver reads out of the hand-off), not the generic claude.ai/code entry point — while the opening event still honestly records the generic link that was all that was known before the session existed. The contract that the deep link wins is pinned end to end, through the real cloud driver, the real telemetry, and the real meta fold, rather than per layer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
