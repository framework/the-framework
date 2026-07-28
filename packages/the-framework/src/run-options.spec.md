Pure mapping from the user's resolved preferences to the `StartRunOptions` a run starts with (#858), shared by the dashboard launcher and auto PM so unattended runs honour the same settings.

## TLDR

- `runOptionsFromPreferences()`: the one mapping (autopilot defaults on, browser Claude-only, eco drops suppressed under vanilla/transparent, four eco preferences collapsed into one object, non-local `target` only when set).
- `preferencesFromFileConfig()` (#842): a repo's committed `the-framework.yml` translated into preference keys (only keys the file set come back; `antiLazyPill` is the file's name for the inverse of `vanilla`).
- `handoffFromPreferences()` (#1102): both halves default on; opening a PR implies pushing (gh won't open one for a branch the remote has never seen), normalised here rather than in the three places that read it.
- `autopilotEnabled()`: absent = on (the demo default, matching old localStorage semantics).

## Decisions

- Lives here in node-free pure code, not the dashboard client: auto PM (#685) also starts runs and used to pass nothing, so unattended runs ignored agent/model/per-project settings. Re-exported from the browser-safe `./client` entry (#431).
- The toggles `the-framework.yml` also owns (autopilot/technical/vanilla/transparent) and the default-ON handoff pair travel explicitly, `false` included: the caller already resolved every layer it can see, and sending nothing would let a lower layer turn back on what the launcher just showed as off (#842, #1102).
- `browser` is sent only for the `claude` agent (#801): another agent's driver takes no MCP servers, so sending it would only earn the CLI's "no effect" notice.
- Takes the merged view, not the two tiers: who wins between global and project setting is `resolvePreferences`' job.
