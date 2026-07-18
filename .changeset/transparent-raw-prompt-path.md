---
"@gemstack/framework": patch
---

Fix transparent mode so it is actually raw Claude Code (#678). Transparent (#625) is meant to run identical to `claude -p <your prompt>`, but a build-kind run (a plain typed prompt, the dashboard default) still went through the full `runFramework` orchestration (scope, plan, dispatch, synthesize, production-grade pass) and sent the wrapped `extendPrompt`/`buildPrompt` text to the agent instead of the raw prompt, because run-path routing keyed only off the `research`/`prompt` subcommands. Transparent now routes any run through the raw prompt path, so the prompt runs verbatim with no build orchestration and no wrapping. Research rendering still applies only to a genuine (non-transparent) research run.
