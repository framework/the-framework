The build flow (`runFramework`): detect the framework, compose the system channel once, drive autopilot's Bootstrap through the driver, then the backlog loop, optional preview, and the chat phase.

## TLDR

- Framework detection is **narration only** — nothing about it reaches the prompt; what stack to build on is the agent's own call.
- The review checklist comes from the selected domain preset's loops, optionally merged with a **serve check** that actually boots the app — so a pass must both read production-grade and really serve.
- Owns the abort composition: caller signal + budget + consumption guard + plan-decline, combined into one run signal.

## Decisions

- **No preset and no `--serve` means nothing reviews the build**: the agent is treated as a clever black box and the framework does not second-guess it. Bootstrap runs no checklist loop at all in that case.
- A **hands-off** driver (the cloud target) drops every phase after build — checklist, improve, backlog gate, chat. The work is happening somewhere else; reading the driver's "handed off" summary back as agent output produced bogus verdicts and unanswerable gates.
- A build **continuation** sends the message verbatim, without re-rendered scope/build preamble — the resumed transcript already carries its framing.

## Facts

- With no checklist step, Bootstrap can settle without ever re-checking the abort signal — so `runFramework` re-checks it itself before declaring success.
- The empty-workspace scaffold verification is off for the fake driver, which writes nothing.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
