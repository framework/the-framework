/**
 * The types the dashboard reads the daemon's answers as.
 *
 * Not a library API: nothing imports this package by name, and the browser gets its *values* from
 * `client.ts` (the node-free entry) and its data over `POST /_rpc/<name>`. What is left here is the
 * vocabulary of those answers — one import site for a browser file that would otherwise reach into
 * two dozen modules to name what an RPC returns.
 *
 * Type-only on purpose. A value re-exported here would pull the module that defines it into the
 * browser bundle, which is the failure `client.ts` exists to prevent; `export type` erases at build.
 *
 * Every name below is imported by a file under `dashboard/`. That is the whole rule: this file
 * ends where its consumers end, so a name nothing renders cannot quietly live on in it.
 */

export type { AgentError, HandoffState, SessionInfo } from './agent-view.js'
export type { AutoPmJob, AutoPmOutcome, AutoPmReport } from './auto-pm.js'
export type { FrameworkFileConfig } from './config.js'
export type { ChoiceRequest, FrameworkEvent } from './events.js'
export type { QuotaBoundaryStatus } from './quota-boundary.js'
export type { AgentLocation } from './agent-location.js'
export type { CustomPreset, Preferences } from './registry.js'
export type { DriverQuotaWindow } from './driver/types.js'
export type { AgentMeta, AgentStatus } from './store/agent-store.js'
export type { Activity } from './dashboard/activity.js'
export type { AgentHandoff } from './dashboard/agent-handoff.js'
export type { BridgeEvent, BridgeQuestion } from './dashboard/bridge-endpoints.js'
export type { BridgeAnswer } from './dashboard/bridge-store.js'
export type { DashboardData } from './dashboard/dashboard.js'
export type { WorkspaceDoc } from './dashboard/docs.js'
export type { FileChange, FileDiff } from './dashboard/file-diff.js'
export type { FileContent } from './dashboard/file-read.js'
export type { GitStatus } from './dashboard/git-status.js'
export type { Intervention } from './dashboard/interventions.js'
export type { OpenQuestion } from './dashboard/open-questions.js'
export type { ActiveAgent, HotBucket, HotTicket, Overview, ProjectTickets, RecentAgent } from './dashboard/overview.js'
export type { ProjectSummary, ProjectionRead } from './dashboard/projects.js'
export type { ProjectError, ProjectErrorCode } from './project-errors.js'
export type { ProjectQueue } from './dashboard/queue.js'
export type { QuotaView } from './dashboard/quota.js'
export type { TicketsMeta, WorkspaceTicket, WorkspaceTicketDetail } from './dashboard/tickets.js'
export type { AgentWorktree, OnboardingSuggestion } from './dashboard/types.js'
