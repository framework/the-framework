The device side of the remote-run relay (#1067 slice 2): dispatches a relayed run-scoped RPC against this device's own home checkout.

## TLDR

- `RELAY_FNS` is a whitelist of run-scoped reads (`onProjectFiles`, `onGitStatus`, `onRun`, `onRunWorktree`, `onRunHandoff`, file diff/changes/content) and steering writes (`sendStop`, `sendChoice`, `sendMessage`, `sendSetHandoff`, `sendPushBranch`, `sendOpenPullRequest`); `dispatchRelayRpc(homeId, fn, args)` invokes one, throwing on unknown names.
- `args[0]` (the remote daemon's project id, meaningless here) is replaced with this device's home project id, so a relayed call can only ever address the device's own home checkout, never another registered project.

## Decisions

- Whitelist only: start/preview/delete stay off it.
- The dispatched functions resolve paths through the same registry as the browser's own calls and use no Telefunc request context, so calling them directly is sound.
