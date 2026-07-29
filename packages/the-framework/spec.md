`@gemstack/the-framework` — the product package: turnkey, zero-config AI orchestration ("Vite for AI") that wraps a coding-agent CLI (Claude Code today; Codex, GitHub Actions, cloud too) as a black box and takes an idea to a running app, with a CLI + daemon + localhost dashboard.

## TLDR

- `src/` — all implementation: CLI/daemon, run orchestration on ai-autopilot's spine, the driver seam, run store/worktrees, presets, quota, Discord bridge, dashboard serving (see `src/spec.md`).
- `prompts/` — the prompting, authored as markdown and compiled into `src/prompts.generated.ts` at build time: `system_prompt.md` (ships verbatim from issue #326), `on_before_mergeable_prompt.md`, `ticketing_format.md`, `todo_format.md`, `presets/*.md` (16 preset prompts: security_audit, spike_and_plan, drain_queue, triage_*, research, ux, ...), `protocols/*.md` (await, browser, hands_off, signal).
- `scripts/` — `gen-prompts.mjs` (md → ts), `check-prompt-drift.mjs` (prompts vs issue #326), `bundle-dashboard.mjs` (embed the prerendered dashboard), `run-tests.mjs`.
- Docs: `README.md` (product + library API), `VISION-ROADMAP.md`/`VISION-BRAINSTORMING.md` (planning notes), `CHANGELOG.md`.

## Facts

- package.json: bin `the-framework` → `dist/bin.js`; publishes only `dist/`; exports `.` (full library), `./dashboard-rpc` (Telefunc surface for the dashboard app), `./client` (browser-safe client). Runtime deps are just `@gemstack/ai-autopilot`, `telefunc`, `yaml`; Node >= 22.12.
- Every build/test/typecheck script runs `gen-prompts.mjs` first — `src/prompts.generated.ts` is generated, git-ignored, and required to compile.
- The dashboard UI itself lives in the private sibling package `framework-dashboard`; its prerendered client bundle is copied into this package's dist for release (`bundle:dashboard`), with a legacy fallback page when absent.
- Core stance (README): the framework does not run its own agent — it prompts, lets the agent's own loop run, reads the code, and gates on the outcome; the wrapped agent keeps its subscription auth and stays swappable.
