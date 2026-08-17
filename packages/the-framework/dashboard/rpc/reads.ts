import type * as impl from '../../src/dashboard-rpc/reads.js'
import { rpc } from '../lib/rpc.js'

// The types the RPCs speak in, straight from the implementations — erased at build, so importing
// them here pulls no server code into the bundle.
export type * from '../../src/dashboard-rpc/reads.js'

// Typed stubs for the `reads` RPCs (F3). Each is checked against the implementation's own
// signature, so a rename or a changed argument is a type error here rather than a 404 at runtime.
// These used to be re-export shims whose only job was pinning Telefunc's baked RPC keys to this
// file's path; the transport addresses calls by name now, so the path carries no meaning.

export const onAgents = rpc<typeof impl.onAgents>('onAgents')
export const onRetainedWorktrees = rpc<typeof impl.onRetainedWorktrees>('onRetainedWorktrees')
export const onAgentWorktree = rpc<typeof impl.onAgentWorktree>('onAgentWorktree')
export const onAgent = rpc<typeof impl.onAgent>('onAgent')
export const onDocs = rpc<typeof impl.onDocs>('onDocs')
export const onTickets = rpc<typeof impl.onTickets>('onTickets')
export const onTicket = rpc<typeof impl.onTicket>('onTicket')
export const onTicketsMeta = rpc<typeof impl.onTicketsMeta>('onTicketsMeta')
export const onAllTickets = rpc<typeof impl.onAllTickets>('onAllTickets')
export const onQueue = rpc<typeof impl.onQueue>('onQueue')
export const onOverview = rpc<typeof impl.onOverview>('onOverview')
export const onRecentAgents = rpc<typeof impl.onRecentAgents>('onRecentAgents')
export const onHotTickets = rpc<typeof impl.onHotTickets>('onHotTickets')
export const onInterventions = rpc<typeof impl.onInterventions>('onInterventions')
export const onOpenQuestions = rpc<typeof impl.onOpenQuestions>('onOpenQuestions')
export const onActivity = rpc<typeof impl.onActivity>('onActivity')
export const onDashboard = rpc<typeof impl.onDashboard>('onDashboard')
export const onProjectFiles = rpc<typeof impl.onProjectFiles>('onProjectFiles')
export const onProjectFileStatus = rpc<typeof impl.onProjectFileStatus>('onProjectFileStatus')
export const onFileDiff = rpc<typeof impl.onFileDiff>('onFileDiff')
export const onAgentChanges = rpc<typeof impl.onAgentChanges>('onAgentChanges')
export const onFileContent = rpc<typeof impl.onFileContent>('onFileContent')
export const onGithubUrl = rpc<typeof impl.onGithubUrl>('onGithubUrl')
export const onGitStatus = rpc<typeof impl.onGitStatus>('onGitStatus')
export const onAgentHandoff = rpc<typeof impl.onAgentHandoff>('onAgentHandoff')
export const onSystemPromptUser = rpc<typeof impl.onSystemPromptUser>('onSystemPromptUser')
export const onRetiredProjectSettings = rpc<typeof impl.onRetiredProjectSettings>('onRetiredProjectSettings')
export const onBridgeQuestion = rpc<typeof impl.onBridgeQuestion>('onBridgeQuestion')
export const onBridgeStatus = rpc<typeof impl.onBridgeStatus>('onBridgeStatus')
export const onBridgeToken = rpc<typeof impl.onBridgeToken>('onBridgeToken')
export const onBridgeAnswer = rpc<typeof impl.onBridgeAnswer>('onBridgeAnswer')
export const onBridgeEvents = rpc<typeof impl.onBridgeEvents>('onBridgeEvents')
