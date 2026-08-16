// The dashboard's RPC surface (#405), served in-process by the daemon so `sendStart` can reach
// the daemon's own `startRun`. The browser calls these by name over `POST /_rpc/<name>`; the
// dashboard's `rpc/` modules are typed stubs against these signatures, so a rename that misses
// one is a type error rather than a 404 at runtime.
export { onRuns, onRun, onDocs, onQueue, onOverview, onRecentRuns, onHotTickets, onInterventions, onOpenQuestions, onActivity, onDashboard, onGithubUrl, onGitStatus, onProjectFiles, onProjectFileStatus, onFileDiff, onRunChanges, onFileContent, onTickets, onTicket, onTicketsMeta, onAllTickets, onRetainedWorktrees, onRunWorktree, onRunHandoff, onSystemPromptUser, onBridgeQuestion, onBridgeStatus, onBridgeToken, onBridgeEvents, onBridgeAnswer } from './reads.js'
export { sendStop, sendChoice, sendBridgeAnswer, sendBridgeAnswerCancel, sendMessage, sendSetHandoff, sendStart, sendOpenInApp, sendRemoveWorktree, sendDeleteSession, sendPushBranch, sendOpenPullRequest, sendMerge, sendQueueTicket, sendReleaseTicketLock, type QueueTicketResult, type QueuedTicket } from './control.js'
export { streamRunEvents, type LiveFeedEvent, type StreamSync } from './events.js'
export { onProjects, sendAddProject, onOnboarding, onClaudeTrust, onDriverReady, onRepoAutoMerge } from './projects.js'
export {
  onPreferences,
  savePreferences,
  patchPreferences,
  onProjectPresets,
  saveProjectPresets,
  onEditors,
  onNotifyChannels,
  saveDiscordCredentials,
  type SavePreferencesResult,
  type PatchPreferencesResult,
  type NotifyChannels,
} from './preferences.js'
export type { CredentialSource, DiscordCredentialStatus, DiscordCredentialsPatch } from '../discord-credentials.js'
export { type EditorInfo } from '../dashboard/open-in-app.js'
export { onQuota, onAutoPm, sendAutoPmSweep } from './quota.js'
export { checkDevices, type DeviceCheck } from './devices.js'

import * as reads from './reads.js'
import * as control from './control.js'
import * as projects from './projects.js'
import * as preferences from './preferences.js'
import * as quota from './quota.js'
import * as devices from './devices.js'
import { streamRunEvents } from './events.js'

/** One RPC: called with whatever the browser sent, answering with whatever JSON.stringify keeps. */
export type RpcHandler = (...args: never[]) => unknown

/**
 * Every RPC the mount will answer, by name.
 *
 * Built from the modules' own exports rather than listed by hand, so a function that is exported
 * and simply never registered — the failure that shipped per-project preferences broken (#866),
 * a 400 and nothing else — cannot happen: the name IS the export name.
 */
export const RPC_HANDLERS: Record<string, RpcHandler> = Object.fromEntries(
  [reads, control, projects, preferences, quota, devices]
    .flatMap(module => Object.entries(module))
    .filter((entry): entry is [string, RpcHandler] => typeof entry[1] === 'function'),
)

/** The live event stream, which is a subscription rather than a call — see `rpc-serve.ts`. */
export const RPC_EVENT_STREAM = streamRunEvents
