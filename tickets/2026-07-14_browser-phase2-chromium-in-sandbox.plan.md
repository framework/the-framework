Effort: 3
Uncertainty: 7

# [Plan] Browser Phase 2: bundle Chromium into the sandbox runner image

Assessment of a ticket whose premise went stale — the Docker runner image it targets was never built — plus a concrete re-scoped implementation for giving remote (`--run-on actions`) agents a browser, and the case for closing the ticket instead.

## TLDR

- **The ticket's target environment does not exist.** There is no Docker runner image, no Dockerfile, and no agent-in-container work (#109) anywhere in the codebase or its git history. Remote isolation shipped along a different axis: agents run `local`, on a **GitHub Actions runner**, or on **Claude Code on the web** — exactly the three locations in `packages/framework/src/agent-location.ts`. The "Alpine + chromium + fonts + `--no-sandbox`" scope only makes sense for a framework-owned image that nothing currently plans.
- **The ticket's gating question is answered by the code.** "Has Phase 1 proven browser access valuable?" — Phase 1's `--browser` (#452/#466) did not just survive, it grew: the agent-owned shared headless Chromium (#793), the live screencast preview (#609/#802), the human hand-off on login walls/captchas (#796), and three `FEATURES-SPEC.md` entries. Browser access is a kept, extended, landing-page-worthy feature (see also ticket 2026-07-26_landing-headless-browser).
- **Recommended path: re-scope Phase 2 to "browser for remote runs", starting with the Actions runner.** The Framework owns `framework-agent.yml`, GitHub's `ubuntu-latest` runners ship Google Chrome, and the wiring is a workflow input plus a `--mcp-config` flag — small, concrete, unblocked. The `web` target already has Chromium inside Anthropic's own sandbox and offers The Framework no config channel, so it needs documentation at most.
- **Human decision needed** (hence Uncertainty 7): re-scope as proposed, close as superseded, or keep dormant. The implementation itself, once scoped to Actions, is low-uncertainty (Effort 3).

## What changed since the ticket was written (2026-07-14)

The ticket assumes the world of #452/#109: agent on the host, app served inside a Docker "runner" container, and a future where the agent itself moves into that container. None of that exists in today's codebase:

- **No Docker anywhere.** No Dockerfile, no `docker run`, no runner image — in the working tree or in `git log -S docker` across all branches. The only "docker" hits are data-branch ticket syncs.
- **Remote execution shipped as drivers, not containers.** `packages/framework/src/driver/actions.ts` (#610) dispatches `.github/workflows/framework-agent.yml` — one workflow run per turn on a disposable `ubuntu-latest` runner, transcript read back from an artifact. `packages/framework/src/driver/cloud.ts` (#610) hands the task to Claude Code on the web via the CLI's own `--cloud`; that session is hands-off (no read-back channel at all, `isHandsOff()` in `agent-location.ts`).
- **Phase 1 evolved past "MCP launches a browser".** `packages/framework/src/browser.ts`: the framework now launches Chrome itself (`--headless=new`, `--remote-debugging-port`, throwaway profile) and points chrome-devtools-mcp at it with `--browserUrl`, so a second CDP client — the screencast preview (#609/#802) and the step-in relay for login walls (#796) — can watch the same page.
- **`--browser` is explicitly local-only today.** `cli.ts` (~line 1094): for `--run-on web`/`actions` the flag is refused with a note — "the browser tools are wired on this machine, and the session runs elsewhere" — because the MCP config never leaves the machine, and the system channel must only claim a browser the agent really has (#824).

Caveat: the referenced GitHub issues (#109, #452, #469) live on `gemstack-land/the-framework`, which this session cannot read; the "never happened" claim is based on this repository's code and full history, which is where the result would have to live.

## Problems

1. **Stale premise — what does "the sandbox" even mean now?** (the real uncertainty, 7/10)
   The ticket is blocked on #109, and #109's direction (agent inside a framework-owned Docker container) was superseded by the `local | actions | web` location axis. Either the ticket is re-pointed at the sandboxes that actually exist, or it has no target.
2. **Which remote target to give a browser** (uncertainty 4/10 once problem 1 is decided)
   Actions and web differ completely in what The Framework controls.
3. **How browser wiring reaches a remote agent** (uncertainty 3/10)
   Locally it rides the driver's `--mcp-config` file; a remote agent never sees this machine's MCP config.
4. **What is lost remotely: preview and hand-off** (uncertainty 2/10 — a fact to accept, not a choice)
   The screencast (#802) and the human hand-off gate (#796) attach over a local CDP port. A browser inside an Actions runner or a cloud sandbox has working *tools* but no reachable CDP endpoint on the user's machine: no live preview, and an agent that hits a login wall can only report it, not hand it over.

## Solutions

### Problem 1 — what to do with the ticket

- **A (recommended): re-scope to "browser for remote runs"** and implement the Actions half (see Implementation). This preserves the ticket's actual intent — "browser access when the run is isolated" — against the isolation mechanisms that exist.
- **B: close as superseded.** Defensible: the `web` sandbox already ships Chromium (Anthropic's own environment pre-installs it), Actions agents have survived without a browser, and the original Docker scope is void. Costs nothing now; re-open if remote agents start building web apps they cannot verify.
- **C: keep blocked-dormant** waiting for a framework-owned container runtime. Not recommended — nothing in the repo, VISION.md, or the open tickets points that way.

### Problem 2 — which target

- **Actions (recommended first):** The Framework owns the workflow file, the dispatch inputs, and the driver. `ubuntu-latest` ships Google Chrome, runs jobs as a non-root user (Chrome's own sandbox works — no `--no-sandbox` needed), and has network for `npx -y chrome-devtools-mcp`. Everything the local path needs exists there.
- **Web:** Anthropic's cloud sandbox pre-installs Chromium (e.g. `/opt/pw-browsers/chromium`, advertised to the session itself), and the session is hands-off — The Framework has no per-run config channel. The only lever is repo content (a committed `.mcp.json` would wire chrome-devtools-mcp for *every* Claude Code run in that repo, not per-run). Verdict: document that cloud agents already have a browser via Playwright/Chromium; do not build anything.
- **Both via a committed `.mcp.json`:** rejected as the primary mechanism — it is repo-global, not per-run, and silently changes every contributor's Claude Code session in that repo.

### Problem 3 — wiring for Actions

- **(recommended)** A new `browser` workflow-dispatch input; when `"true"`, the compose step writes a chrome-devtools-mcp MCP config file on the runner and appends `--mcp-config <file>` to `claude_args`. The driver passes the input; the CLI stops refusing `--browser` for `--run-on actions`.
- Alternative: always-on browser in the workflow (no input). Simpler, but every turn pays the `npx` fetch and violates the existing opt-in posture of `--browser` (#452, "the browser is opt-in").

### Problem 4 — degraded remote UX

Accept it for v1 and say so honestly: gate the #824 promise (`browserAttached` and the system-channel claim) so a remote agent is told it has browser *tools* but no preview/hand-off, and the dashboard's Browser option row explains the difference. A CDP relay from runner to dashboard is possible in principle (a tunnel) and clearly out of scope.

## Considerations

- **Headless is mandatory on a runner** (no display). chrome-devtools-mcp supports headless operation; the config on the runner must request it rather than rely on a default that may try headed Chrome.
- **Chrome sandbox vs. root:** only a concern inside containers running as root (the original ticket's `--no-sandbox` note). `ubuntu-latest` jobs run as the non-root `runner` user, so it does not apply. If a project overrides the workflow to run in a container, that is their workflow to adapt — the SPEC for the workflow should say so.
- **Security posture shifts:** an Actions agent holds a repo-scoped token (`contents: write`, `pull-requests: write`) *and* would now read arbitrary web content — prompt-injection from a page it browses sits next to push credentials. Same class of risk as local `--browser` beside the user's own credentials, but worth one sentence in the workflow SPEC.
- **#824 invariant** ("the system channel must only claim a browser the agent really has") must be preserved: `browserAttached` in `cli.ts` is currently `local && claude`; an Actions browser makes that condition target-dependent, and the system-prompt text must distinguish tools-only from tools+preview.
- **Options plumbing already anticipates this:** the dashboard's Browser row (`dashboard/lib/agent-option-rows.ts`) is Claude-only and currently silent about targets; the `--browser`-has-no-effect note in `cli.ts` and its test (`cli.test.ts`, #452) must change in step.
- **Per-turn cost:** each Actions turn is a fresh runner, so each browser turn re-fetches `chrome-devtools-mcp` via `npx -y` (seconds, on a runner that already spends minutes). Acceptable; pinning a version instead of `@latest` is the same decision the local path already made (it uses `@latest`).
- **`FEATURES-SPEC.md`** must gain/adjust the feature line if remote browser lands (currently the three browser lines describe the local experience).
- **The old Alpine notes** (chromium + fonts + `--no-sandbox`, MCP pointed at an in-container browser) stay valid *if* a framework-owned image ever appears; they should not drive work before then.

## Implementation

Only under decision A (re-scope to Actions); listed in dependency order, all changes small:

1. **`.github/workflows/framework-agent.yml`** (and its SPEC): add optional `browser` dispatch input. In the compose step, when set: write an MCP config JSON (chrome-devtools-mcp, headless) to a runner-local file via a heredoc — no interpolation of user input — and append `--mcp-config <path>` to the composed `claude_args`.
2. **`src/driver/actions.ts`**: accept a `browser` flag in `ActionsDriverOptions` (or per-turn in the dispatch inputs) and include it in the `workflow_dispatch` payload. Validate as a boolean-shaped literal like the existing model/session-id inputs.
3. **`src/cli.ts`**: for `--run-on actions`, stop printing the "no effect" note and instead pass the flag to the driver; keep the note (reworded) for `--run-on web`. Keep `launchSharedBrowser()` strictly local — no shared Chrome, no `browserStream`, for remote targets.
4. **`browserAttached` / system channel (#824)**: extend to `actions` with a distinct phrasing (browser tools, no preview, no human hand-off — a login wall is a dead end to report, not a gate).
5. **Dashboard**: `agent-option-rows.ts` Browser row — enabled for the Actions target with a hint that preview/hand-off are local-only.
6. **Tests**: `actions.test.ts` (input travels in the dispatch), `cli.test.ts` (note logic per target, `withBrowser` unchanged locally), workflow compose-step behavior covered by the existing pattern for model/resume args.
7. **`FEATURES-SPEC.md`**: update the browser feature lines.
8. **Docs for `web`**: one paragraph (README / feature docs): cloud sessions run in Anthropic's sandbox which pre-installs Chromium; no Framework wiring exists or is needed.

Out of scope, recorded deliberately: any framework-owned Docker image (the original ticket text), a CDP relay for remote preview, and committed `.mcp.json` files in user repos.
