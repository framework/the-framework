The dashboard's write-side telefunctions (#405): steering live runs via their control log, starting runs/previews, worktree cleanup, session handoff (push/PR), and queueing tickets.

## TLDR

- Steering writes append one entry to the addressed run's `.the-framework/control.jsonl` (which the run tails): `sendStop`, `sendSetHandoff` (#1102 arm/disarm end-of-session push+PR), `sendChoice` (#304/#332 resolve a parked gate, `by` records who picked), `sendMessage` (#714 live chat drained between turns via `--resume`; `via` names the surface, #917).
- Bridge answers (#1237): `sendBridgeAnswer`/`sendBridgeAnswerCancel` queue/withdraw a pick for a Claude-web session in the bridge store — the browser extension types it into the session's composer; only a label of the currently parked question is accepted; local only, no relay.
- Worktree lifecycle: `sendRemoveWorktree` (#737/#982) and `sendDeleteSession` (#1032, the one destructive-of-history action) share `withWorktreeRemoval`, which stops a preview serving the tree (#797) before removal; checks live in `worktrees.ts`, shared with the CLI verb.
- `sendStart` / `sendStartTopic` (#1120): call the daemon's `startRun` closure off the context (one-run-per-project busy guard); topic runs spawn in a neutral scratch dir with no repo.
- Preview: `sendPreview`/`sendStopPreview`/`onPreviewStatus` (#475), `onServeTargets` (#651 Serve picker); with a session id serves that session's worktree (#797).
- `sendOpenInApp` (#490): spawn a local file manager/editor; `runId` opens the session's own checkout (#798); honours the stored editor preference, then `$FRAMEWORK_EDITOR`, then `code` (#727).
- Handoff: `sendPushBranch`/`sendOpenPullRequest` (#799) commit the session's uncommitted work from its checkout onto its branch first, then push / open the PR from the project repo.
- `sendQueueTicket` (#697): append an entry to the project checkout's flat backlog; with a `ticket` it lands in the matching `## Priority N` section and links back via markdown link (#1164).

## Problems

- A control entry written to the project root reaches nothing: since #736 a run tails the log inside its own worktree, so every steering call carries `runId` and resolves through `resolveRunPath` (#749).
- Telefunc exposes `getContext` only synchronously at the top of a telefunction, so `withWorktreeRemoval` reads the preview handler before the first await.
- A retained worktree can still be served by a dev server (#797): removal stops the preview via `beforeRemove` rather than pulling the directory out from under it.

## Decisions

- Steering is file-is-the-seam, mirroring the daemon's legacy onStop/onChoice (#344/#393): events flow run → events.jsonl → Channel → browser; steering flows browser → control.jsonl → run.
- `appendControlFor` is a no-op with no local path, so the read-only relay never writes a run channel; run-scoped calls are wrapped in `relayOr` to forward to a connected device (#1067).
- The handoff pair is normalised on write (`push: push || pr`) since a PR needs the branch on the remote; the run echoes what it applied as an event so the UI reads run meta, not local state.
- The ticket a hand-fired drain works is resolved server-side from the queue (#1117), never trusted from the browser; an explicit `options.ticket` wins.
- Pushing/opening a PR is a click, not automatic on run exit: publishing under the user's name is the user's call.
- `sendQueueTicket` writes the file directly rather than asking an agent — one line should not cost a turn (and an agent could do anything else besides).
- `sendStartTopic` is a separate RPC rather than an absent-projectId overload, keeping `sendStart`'s home-default behavior untouched.
- Unsafe `via` names are dropped (`isSafeVia`): they reach a line-parsed conversation heading and the browser is untrusted input.
- Bridge session ids are validated against `^session_[A-Za-z0-9]{1,128}$`.
