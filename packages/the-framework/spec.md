`@gemstack/the-framework` — the product: a CLI + per-machine daemon + localhost dashboard that drives a coding-agent CLI (Claude Code, Codex) as a **black box**, from one-shot builds up to a fully autonomous work queue.

## TLDR

- The product never runs its own model. It prompts a wrapped agent CLI, lets the agent's own loop run to completion, reads the code it produced, gates on the **outcome** (builds / serves / review passes), and re-prompts. The wrapped agent keeps its own subscription auth.
- It sits on `@gemstack/ai-autopilot`'s bootstrap spine and adds the two pieces autopilot has no opinion about: the **driver seam** (`src/driver/`) and the **product shell** (CLI, daemon, dashboard serving, autonomy loops, chat surfaces).
- Every run gets its own git worktree and branch; a session left alone commits, pushes, opens a draft PR, and (when armed) merges on green.
- Autonomy: a durable `TODO_AGENTS.md` queue drained one entry per turn, an idle sweep that refills it, and a weekly-quota boundary that keeps unattended work from starving the human.
- Layered opt-out everywhere: CLI flags > per-repo `the-framework.yml` > per-project preferences > global preferences; `--transparent` makes a run byte-identical to raw `claude -p`.
- Map: `src/spec.md` (run lifecycle core and file map), `src/driver/`, `src/store/`, `src/dashboard/`, `src/dashboard-rpc/`, `src/discord/` (each with its own spec). `prompts/` holds everything agent-facing — the built-in system prompt (macro-style, ending in the `# User prompt` split point), the four emit-protocol texts, one file per preset, and the two format specs (`ticketing_format.md`, `todo_format.md`) — so prompting changes without touching code. (No spec.md may live inside `prompts/`: the build compiles every non-README `.md` there into generated constants.)

## Problems

- A coding-agent CLI is a black box: the only readable outputs are the code and each turn's final message. Everything the framework "knows" about a turn is parsed from that message (the turn-boundary protocol).
- Daemon-spawned runs have their stdio ignored, so anything a run wants to say — including skips and failures — must be an event in its log, never a print.

## Decisions

- **Files are the seam**: a run appends `events.jsonl`, the daemon tails it; steering flows back through `control.jsonl`. No IPC.
- **Pure vs Node split, enforced by a test**: a test walks the import graph from the browser-safe `client.ts` entry and fails on any reachable `node:*` edge — which is why prompts are compiled to generated constants (the dashboard previews prompts *in the browser*; a runtime `node:fs` read would break the bundle) and why several modules exist as pure/Node file pairs.
- The two format specs travel **inside the system channel**, verbatim — they used to be referenced as `node_modules/...` paths, which only resolve when the framework is a root dependency, so agents couldn't open them and the governed files drifted from the spec.
- **Injectable seams everywhere**: nearly every module takes its fs / git runner / gh / clock / probe as a defaulted parameter, so logic tests run off disk and off network. Failures are values (`{ok:false}` or a named skip reason), not throws, on every persistence and integration path.
- **Never `git add -A`**: every automatic commit is scoped to a known pathspec, so the user's index and in-progress work are untouched.
- **Fail-open on spend, fail-closed on autonomy**: an unreadable quota leaves a user-started run running (with `--max-cost` still underneath) but stops the unattended sweep.
- Behavior keys off data on objects (job capabilities, gate kinds, retry-ability), never name-matching at call sites — a rename must not silently unhook behavior.

## Facts

- Three runtime dependencies (`ai-autopilot`, `telefunc`, `yaml`); Node ≥ 22.12; global `fetch`/`WebSocket` used directly.
- The published package carries the prerendered dashboard as static files (`dist/dashboard-client`, copied in by a build script); a missing bundle degrades to a legacy minimal dashboard rather than failing `npm pack`.
- Exports: `.` (server API), `./dashboard-rpc` (the telefunction implementations), `./client` (the browser-safe subset the dashboard imports).
- The system prompt is owned on a GitHub issue (designed/reviewed there first); a scheduled workflow fails when the repo copy drifts from it.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
