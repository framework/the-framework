The orchestration engine: how many agent runs are composed into one outcome — a bootstrap spine that takes an app from nothing to production-grade, review loops that gate on verdicts instead of vibes, and a supervisor that fans work out and synthesizes it back.

## TLDR

- This layer is policy, not mechanism: which agents run, in what order, how results combine, when to stop, under what budget — anything that is just "call the agent runtime" stays in the runtime.
- The core conviction: don't trust a single pass — work is re-examined with fresh eyes against an explicit list of blockers, and only an empty list counts as done.
- Everything long-running streams progress events and can be watched from a terminal, a UI, or a detached background handle — the same replayable stream, joinable late from any offset.

## Flows

- **Bootstrap** sequences four phases: **scope → build → loop → deploy**. Scope is the one and only interrogation — is this a prototype or the real thing, and what is it for. Build produces the app. The loop then repeats a production-grade checklist, fixing what it finds, until the checklist reports no blockers or the pass budget runs out. The checklist can be composed with a serve check that actually installs, boots, and fetches the app — so "production-grade" must both read true and demonstrably run. Deploy decides the app's shape (server-rendered, static, single-page) and hands execution to a target adapter (Cloudflare and Dokploy ship real ones; a plan-only target just narrates). Every phase is injectable, so the whole flow runs offline in tests.
- **The verdict convention**: a review prompt ends its answer with a machine-readable list of blockers — empty means passing; non-empty is the concrete work still required.
- **The loop** maps semantic events — "major change", "new UI flow" — to ordered chains of review prompts, each run for a configured number of fresh-context passes. By default a chain fires and reports; switched to gate mode, it stops hard at the first non-passing prompt.
- **The decisions ledger** records settled choices and rejected ideas with their reasons, round-tripped to a human-editable markdown file. Agents consult it through tools and get a briefing of relevant decisions prepended to their prompts — a convention the prompts follow, not a hard gate.
- **Scale mode** keeps a code-overview map current for large repos, refreshing it only on a *material* change — build or test tooling changed, a restructuring, a change sweeping many files across several areas — never on every edit.
- **Framework detection** scores a project's dependencies and files against presets, and always falls back to the flagship preset so a run is never without one.
- **Domain presets** bundle the loops and prompts a domain works under (software development, web development, data science, …) as one selectable, composable unit — authored in code or loaded from a folder of markdown files, with variants picked by declared conditions, most specific eligible one winning. The shipped presets and prompt bodies are data, editable without touching the engine.
- **The supervisor** is the fan-out topology: a planner decomposes the task (capped, so a runaway plan is trimmed), workers run subtasks concurrently under a bounded pool and an optional token budget, one worker's failure never takes down the batch, and a synthesizer combines the results.
- **The runner** is the pluggable workspace where an app gets built and run: in-memory fake, the local machine, a container, or an in-browser sandbox — with tools exposing a booted workspace to an agent, and escapes from the workspace root blocked. The ledger and the overview persist inside a sandboxed workspace exactly as they do on a real disk.

## Rationales

- Each review pass gets a fresh agent with no context carried over — fresh eyes are the whole point of re-examination.
- Scope is the only phase allowed to stop and ask; letting every phase interrogate the human would defeat unattended operation.
- An exhausted pass budget is recorded as stopped-early, not passed — running out of retries is not the same as being done.
- Loops gate on *what the review concluded*, never on whether the prompt merely ran.
- A workspace that cannot run background processes skips the serve-check boot with a note rather than blocking forever.
- The loop is event-driven quality, not run-everything-on-every-change.
- The decisions ledger exists so a later run stops re-pitching what was already turned down.
- Scale mode refreshes only on material change because a stale map is worse than none.
- In framework detection, dependencies weigh double — files lie more; and a new framework is a new preset, not a fork in the engine.
- A supervisor worker that pauses mid-run to ask counts as failed — there is no durable resume at this layer yet.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
