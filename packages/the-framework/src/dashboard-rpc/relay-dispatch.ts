import { onProjectFiles, onProjectFileStatus, onFileDiff, onAgentChanges, onFileContent, onGitStatus, onAgentWorktree, onAgentHandoff, onAgent } from './reads.js'
import { sendStop, sendChoice, sendMessage, sendSetHandoff, sendPushBranch, sendOpenPullRequest, sendMerge } from './control.js'

// The device side of the remote-run relay (#1067 slice 2). A daemon that relayed a run here asks this
// to read/steer/hand off THAT run against THIS device's own checkout. Every entry is a run-scoped RPC
// the dashboard already exposes to its own browser. The only change: arg[0] (the remote daemon's
// project id, meaningless here) is replaced with this device's home project id, so a relayed call can
// only ever address the device's own home checkout, never another registered project. These functions
// resolve their path through the same registry the browser's own calls do (the home project is
// registered at daemon start). They run with no browser request behind them, which is sound because
// the one thing they read off the context here — is this agent relayed onward? — defaults to no,
// and on the device that is the truth: the agent is local here, so forwarding it again would loop.
// Whitelist only: start/preview/delete stay OFF it.

type RelayFn = (...args: unknown[]) => Promise<unknown>
const RELAY_FNS = {
  onProjectFiles, onProjectFileStatus, onFileDiff, onAgentChanges, onFileContent,
  onGitStatus, onAgentWorktree, onAgentHandoff, onAgent,
  sendStop, sendChoice, sendMessage, sendSetHandoff, sendPushBranch, sendOpenPullRequest, sendMerge,
} as unknown as Record<string, RelayFn>

/** The names a relay caller may invoke. */
export const RELAY_RPC_NAMES: readonly string[] = Object.keys(RELAY_FNS)

/**
 * Dispatch one relayed RPC against `homeId` (this device's own project). `args[0]` from the caller is
 * the remote daemon's project id and is meaningless here, so it is replaced with `homeId`; the rest
 * (path, agentId, ...) carry through unchanged. Throws on an unknown name.
 */
export async function dispatchRelayRpc(homeId: string, fn: string, args: unknown[]): Promise<unknown> {
  const impl = RELAY_FNS[fn]
  if (!impl) throw new Error(`unknown relay rpc: ${fn}`)
  return impl(homeId, ...args.slice(1))
}
