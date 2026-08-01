// The dashboard's Telefunc surface (#405), served in-process by the daemon. The
// implementations live here in @gemstack/the-framework so `sendStart` (added with the serve
// wiring) can reach the daemon's `startRun`; the framework-dashboard client imports
// these through thin re-export shims so the baked RPC keys stay `/server/*.telefunc.ts`.
export { onRuns, onRun, onDocs, onProjectLog, onQueue, onOverview, onRecentRuns, onHotTickets, onInterventions, onOpenQuestions, onActivity, onDashboard, onGithubUrl, onGitStatus, onProjectFiles, onProjectFileStatus, onFileDiff, onRunChanges, onFileContent, onTickets, onTicket, onTicketsMeta, onAllTickets, onRetainedWorktrees, onRunWorktree, onRunHandoff, onSystemPromptUser, onBridgeQuestion, onBridgeStatus, onBridgeToken, onBridgeEvents, onBridgeAnswer } from './reads.telefunc.js'
export { sendStop, sendChoice, sendBridgeAnswer, sendBridgeAnswerCancel, sendMessage, sendSetHandoff, sendStart, sendStartTopic, sendPreview, onServeTargets, sendStopPreview, onPreviewStatus, sendOpenInApp, sendRemoveWorktree, sendDeleteSession, sendPushBranch, sendOpenPullRequest, sendMerge, sendQueueTicket, sendReleaseTicketLock, type QueueTicketResult, type QueuedTicket } from './control.telefunc.js'
export { onEvents, type LiveFeedEvent, type StreamSync } from './events.telefunc.js'
export { onProjects, sendAddProject, onOnboarding, onClaudeTrust, onAgentReady, onRepoAutoMerge } from './projects.telefunc.js'
export {
  onPreferences,
  savePreferences,
  patchPreferences,
  onProjectPreferences,
  saveProjectPreferences,
  patchProjectPreferences,
  onProjectPresets,
  saveProjectPresets,
  onEditors,
  onNotifyChannels,
  saveDiscordCredentials,
  type SavePreferencesResult,
  type PatchPreferencesResult,
  type NotifyChannels,
} from './preferences.telefunc.js'
export type { CredentialSource, DiscordCredentialStatus, DiscordCredentialsPatch } from '../discord-credentials.js'
export { type EditorInfo } from '../dashboard/open-in-app.js'
export { onQuota, onAutoPm, sendAutoPmSweep } from './quota.telefunc.js'
export { checkDevices, type DeviceCheck } from './devices.telefunc.js'
export { registerDashboardTelefunctions, DASHBOARD_TELEFUNC_KEYS } from './register.js'
