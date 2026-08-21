export { startDashboard, type Dashboard, type DashboardOptions } from './server.js'
export type { StartAgentKind, StartAgentOptions, StartAgentResult, AddProjectResult, OnboardingSuggestion, DriverReady, PreviewResult, PreviewStatus, AgentWorktree } from './types.js'
export {
  summarizeProject,
  defaultProjectsProvider,
  type ProjectSummary,
  type ProjectionRead,
  type ProjectsProvider,
  type SummarizeDeps,
} from './projects.js'
export { resolveDashboardBundle } from './bundle.js'
export { makeRpcMount, RPC_PREFIX, isSameOriginRequest, isExpectedHost, type EventsSource } from './rpc-serve.js'
export { serveClientBundle } from './static.js'
export { readDocs, DOC_CATEGORIES, type WorkspaceDoc } from './docs.js'
export { readTickets, readTicket, readTicketsMeta, type WorkspaceTicket, type WorkspaceTicketDetail, type TicketsMeta, type TicketGithubLink } from './tickets.js'
export { collectQueue, parseTodoItems, type ProjectQueue, type QueueItem } from './queue.js'
export { buildOverview, buildRecentAgents, buildHotTickets, collectAllTickets, ticketBucket, type Overview, type ActiveAgent as ActiveAgent, type RecentProject, type RecentAgent as RecentAgent, type HotTicket, type HotBucket, type OverviewDeps, type ProjectTickets, type AllTicketsDeps } from './overview.js'
export { buildDashboard, type DashboardData, type ProjectStat, type DashboardDeps } from './dashboard.js'
export { readGitStatus, type GitStatus } from './git-status.js'
export { ghPrView, ghPrList, ghJson, nodeGhRunner, type LinkedPr, type OpenPr, type PrLookup, type BranchPrLookup, type PrLister, type GhRunner } from './gh.js'
export { readFileDiff, readFileChanges, safeRepoPath, type FileDiff, type FileChange } from './file-diff.js'
export { readFileContent, type FileContent } from './file-read.js'
export {
  readAgentHandoff,
  agentBranchFor,
  pushAgentBranch,
  openBranchPullRequest,
  openAgentPullRequest,
  type AgentHandoff,
  type HandoffCommit,
  type HandoffFile,
  type HandoffResult,
  type PullRequestDraft,
  type AgentHandoffDeps,
} from './agent-handoff.js'
export {
  buildInterventions,
  interventionKey,
  pickNewInterventions,
  interventionLine,
  postInterventionsDiscord,
  type Intervention,
  type InterventionsDeps,
} from './interventions.js'
export { buildOpenQuestions, openChoiceRequest, type OpenQuestion, type OpenQuestionsDeps } from './open-questions.js'
export { buildActivity, activityKey, pickNewActivity, activityLine, postActivityDiscord, type Activity, type ActivityDeps } from './activity.js'
export { startKeyedWatcher, SeenTracker, type KeyedWatcher, type KeyedWatcherOptions } from './keyed-watcher.js'
export { BRIDGE_PREFIX, handleBridgeRequest, type BridgeHandlers, type BridgeQuestion, type BridgeSession, type BridgeEvent, type BridgeHello } from './bridge-endpoints.js'
export { bridgeSessionsFrom, BRIDGE_SESSION_WINDOW_MS, BRIDGE_SESSION_LIMIT } from './bridge-sessions.js'
export { bridgeQuestions, resetBridgeQuestions, BridgeQuestions, type BridgeContact, type BridgeAnswer } from './bridge-store.js'
