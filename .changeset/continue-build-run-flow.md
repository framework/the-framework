---
'@gemstack/the-framework': minor
---

Resuming a stopped build run continues it as a build run (#1467): the run's meta now records the flow it started under (`RunMeta.kind`), and a `--continue-run` continuation of a build run re-enters the build flow — the conversation resumes with the message sent verbatim (no re-framing, per #782), while the synthesize framing, the backlog loop and the build ending all run again. Prompt-run continuations and runs recorded before the field keep the direct prompt path unchanged. The continuation also keeps the run's original label instead of being renamed to the resume message.
