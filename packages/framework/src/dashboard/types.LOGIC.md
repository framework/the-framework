Fixes the vocabulary the dashboard and the daemon speak to each other for starting an agent [1], adding a project, running a project's preview, the onboarding suggestion, a driver's [2] readiness, an agent's checkout [3], and the outcomes of removing a checkout or deleting an agent. The shapes live here, on neither the HTTP server nor the RPC mount, so both and the RPCs themselves depend on this one leaf rather than on each other. No behavior lives here; the defaults below are what an absent field means to whoever reads it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] driver: the coding agent a person picks for an agent: `claude-code` or `codex`, the names an agent's card carries.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[4] start hook: the one shell line under `start` in a project's `.the-framework/hooks.yml`, which the daemon runs when the user presses Start; it answers the id of the agent it began.
[17] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[19] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[20] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[21] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **A start's options** - what a Start carries besides its prompt, each absent field leaving the choice to the tool the start hook [4] names: the model, and the driver [2], handed to the hook as `MODEL` and `DRIVER`; and the device [19] to run on, as its URL, its token and a label, which the dashboard sets at submit time from a saved device, is held in memory only, is never written to the preferences [21] or the registry, and is stripped before the start is forwarded so the device starts an ordinary local agent and never relays [20] onward.
- **A start's result** - success, with the agent id [17] the start hook answered, which the dashboard needs to select the agent it just started; or failure, with the reason in words.
- **Adding a project** - registered, together with whether it was already activated; or why not.
- **The onboarding suggestion** - the daemon's own working directory, offered as the one-click first project, with its project id when it is already registered. Both are empty wherever adding projects is not wired, which is the case on the relay [20], so a daemon reached over the network never discloses its filesystem layout.
- **A driver's readiness** - a shape for whether a driver [2] can start an agent: blocking problems, each naming its own fix, and non-blocking warnings. Nothing answers with it any more: a missing or logged-out coding agent shows as a failed agent with its reason.
- **A project's preview** - success with the live URL and the command that serves it, or why not; and whether the preview is running, with its URL and command.
- **An agent's checkout** - its absolute path; whether it is the agent's own checkout [3] or the fallback to the project's checkout; whether it holds uncommitted changes; its branch, absent when the path is not a git repository; its size on disk, read only once nothing is writing to it and best-effort even then; the pull request opened for its branch when there is one; or that the pull request is not known yet because the lookup is still running, as distinct from there being none.
- **Removing a checkout, deleting an agent** - each succeeds or fails with a message.
