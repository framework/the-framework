The orchestration engine's source: the supervisor fan-out core sits at the root, every other subsystem in a directory of its own, all published through a single entry point.

## TLDR

- The root is the supervisor topology: a pluggable planner decomposes the task, worker agents run the subtasks in parallel under a bounded internal pool with guardrails, and a pluggable synthesizer folds the results back into one answer — with the shared contracts and progress events beside it.
- Around it, one directory per subsystem: the runner (the workspace where an app is built and run), the surfaces (watch a run from terminal, page, or background), the decisions ledger (durable memory of settled choices), the loop engine (event-driven review chains), the prompt library (review bodies as data), bootstrap (the nothing-to-production spine), the code overview (scale mode's map), framework detection, and domain presets.
- The planner and synthesizer seats are deliberately swappable — an agent, a static list, hand-rolled logic — because autopilot owns the policy around the stages, not the intelligence inside them.
- Shared manners across subsystems: long-running work narrates itself through events, and an observer's bug is never allowed to abort a run.
- The entry point is the only public face; its opening guide maps the engine, and what it does not publish (like the dispatch pool) is internal.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
