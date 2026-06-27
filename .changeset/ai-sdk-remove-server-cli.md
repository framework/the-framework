---
"@gemstack/ai-sdk": minor
---

Remove the relocated Rudder bindings from the engine: the `/server` provider, the `make:agent` scaffolder, and the `ai:eval` CLI command, plus the `@rudderjs/core` and `@rudderjs/console` optional peers. These now live in `@rudderjs/ai` (Rudder users pick them up there unchanged). The framework-agnostic engine no longer carries any `@rudderjs/*` peer dependency for these paths. Closes the ai-sdk/Rudder decouple epic.
