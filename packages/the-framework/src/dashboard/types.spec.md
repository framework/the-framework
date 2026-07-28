The dashboard's request/result vocabulary (#345/#396/#475): the shapes the Start / Add / Preview RPCs speak, kept in a leaf so the HTTP server, the Telefunc mount, and the telefunctions depend on this rather than on each other.

## TLDR

- `StartRunOptions`: the Global options a Start posts, each mapping to a run flag — modes (autopilot/technical/vanilla/transparent #625, eco), context dirs, browser (#452), auto-push/auto-PR (#1102), model/agent (#628/#650), execution target `local|actions|web` (#1050/#610), `unattended` (#846), ticket/queueEntry pins (#1117/#1253), `via` surface (#917), resume/continue (#720/#762), `remote` device relay (#1067), `topic` project-less runs (#1120).
- `StartRunKind`: `build` (normal framework run) | `prompt` (posted text verbatim — what the page sends after a preset prefilled the textarea) | `research` (server-side preset render, kept for API callers).
- Results: `StartRunResult` (with `runId` — needed since concurrent runs #736 mean "the running one" no longer identifies the run just started, #761), `AddProjectResult`, `PreviewResult`/`PreviewStatus`, `RemoveWorktreeResult` (#737), `DeleteSessionResult` (#1032).
- `RunWorktree` (#798): where a session works — path, own-vs-fallback, dirty, branch, size, PR (+`prPending` #1028).
- `OnboardingSuggestion` (#958): the server's own cwd as the one-click first project; both fields null where adding is not wired (the relay), so a public host never discloses filesystem layout.
- `AgentReady` (#1326): whether the picked agent's CLI can start a run, as `{ ok, problems[], warnings[] }`. Carries what is wrong and what fixes it, never what is right, so no version string or account identity reaches the browser. Both lists are already written for a human.

## Facts

- `autoPushBranch` is tri-state like the `the-framework.yml` toggles: it defaults ON, so an explicit `false` must travel as `--no-auto-push-branch` or the run's own default would re-enable what the launcher showed as off.
- `remote` (`{url, token, label}`) is memory-only relay config set at submit time from a saved device — NEVER persisted to Preferences/registry and never a CLI flag (a device token is a per-browser secret); it is stripped before forwarding so the remote runs locally and never relays onward.
- `unattended` makes choice gates take the recommended option, keeps the run out of the stay-open chat loop (ends at settle so the armed handoff fires); Stop still works — it aborts the run controller, not a gate.
