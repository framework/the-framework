/**
 * `@gemstack/the-framework` — **The (AI) Framework**: turnkey, zero-config AI
 * orchestration. It wraps a coding-agent CLI (Claude Code today) as a **black
 * box** and takes a ticket to a reviewed pull request, with a localhost
 * dashboard that foregrounds the orchestration the agent's own chat cannot show.
 *
 * Two pieces: the **driver** seam that wraps the agent, and the **product shell**
 * (CLI + dashboard) that drives it.
 *
 * ## Driver seam
 * The one abstraction we wrap a coding-agent CLI behind. We prompt it, let its
 * own loop run, read the code, and gate on the outcome (guardrail: the seam is
 * the code, never the agent's tool calls). Swappable, so Codex / opencode slot
 * in behind the same three methods.
 *
 * - {@link Driver} / {@link DriverSession} — the contract
 * - {@link ClaudeCodeDriver} — the first real driver (`claude -p` stream-json)
 * - {@link FakeDriver} — deterministic offline driver for `FRAMEWORK_FAKE` / tests
 *
 * ## Session + product shell
 * - {@link runAgent} — frame the agent, send it one prompt, honor the gates it answers with,
 *   and stream {@link FrameworkEvent}s
 * - {@link startDashboard} — the localhost UI over the event stream
 * - {@link runCli} / {@link parseArgs} — the `framework` command
 */
export * from './driver/index.js'
export { buildPrompt, extendPrompt, scaffoldPrompt, isWorkspaceEmpty } from './steps.js'
export { runAgent, type AgentKind, type RunAgentOptions, type RunAgentResult } from './agent.js'
export { isHandsOff, isAgentLocation, AGENT_LOCATIONS, type AgentLocation } from './agent-location.js'
export {
  requestChoices,
  requestMultiSelect,
  resolveAwaitGate,
  type ChoicesOption,
  type ChoicesDeps,
  type MultiSelectOption,
  type MultiSelectDeps,
} from './await-gate.js'
export {
  parseResetsAt,
  boundaryFromResetsAt,
  quotaBoundaryStatus,
  QUOTA_WEEK_MS,
  type QuotaBoundary,
  type BoundaryWindow,
  type QuotaBoundaryStatus,
} from './quota-boundary.js'
export { pollerQuotaSource, defaultQuotaSource, type QuotaView, type QuotaSource } from './dashboard/quota.js'
export {
  QuotaPoller,
  DEFAULT_POLL_MS,
  MAX_POLL_MS,
  type QuotaEnvelope,
  type QuotaPollerOptions,
} from './quota-poller.js'
export {
  type FrameworkEvent,
  type ChoiceOption,
  type ChoiceRequest,
  type ChoicePick,
  type ChoiceBy,
  type OnBeforeMergeableSkip,
  pickedIds,
  OPEN_LOOP_MODES,
} from './events.js'
export { formatFrameworkEvent } from './terminal.js'
export { resolveSessionLink, hasSessionIdPlaceholder, SESSION_ID_PLACEHOLDER } from './session-link.js'
export {
  sessionInfo,
  agentProgress,
  handoffState,
  type SessionInfo,
  type AgentProgress,
  type HandoffState,
} from './agent-view.js'
export {
  assessRepo,
  planMaintenanceSweep,
  maintainSweep,
  readMaintenanceState,
  writeMaintenanceState,
  mergeMaintenanceState,
  maintenanceDue,
  maintenanceStatePath,
  MAINTENANCE_FILE,
  DEFAULT_MAINTENANCE_INTERVAL_MS,
  type MaintenanceState,
  type RepoReview,
  type MaintenanceAction,
  type SweepSummary,
  type SweepDeps,
  type MaintenanceFs,
} from './maintenance.js'
export { startDashboard, summarizeProject, defaultProjectsProvider, readDocs, type Dashboard, type DashboardOptions, type StartAgentKind, type StartAgentResult, type AddProjectResult, type OnboardingSuggestion, type DriverReady, type PreviewResult, type PreviewStatus, type AgentWorktree, type ProjectSummary, type ProjectsProvider, type SummarizeDeps, type WorkspaceDoc, readTickets, readTicket, readTicketsMeta, type WorkspaceTicket, type WorkspaceTicketDetail, type TicketsMeta, type TicketGithubLink, type ProjectQueue, type QueueItem, type Overview, type ActiveAgent, type RecentProject, type RecentAgent, buildRecentAgents, type HotTicket, type HotBucket, buildHotTickets, collectAllTickets, type ProjectTickets, type AllTicketsDeps, type DashboardData, type ProjectStat, type GitStatus, type LinkedPr, type FileDiff, type FileChange, type FileContent, type AgentHandoff, type HandoffCommit, type HandoffFile, type HandoffResult, buildInterventions, type Intervention, type OpenPr, type PrLister, type InterventionsDeps, buildOpenQuestions, openChoiceRequest, type OpenQuestion, type OpenQuestionsDeps, buildActivity, activityKey, pickNewActivity, type Activity, type ActivityDeps, type BridgeQuestion, type BridgeEvent, type BridgeAnswer } from './dashboard/index.js'
export {
  AgentStore,
  nodeStoreFs,
  applyEventToMeta,
  metaFromEvents,
  listAgents,
  loadAgentEvents,
  agentIdFromStartedAt,
  isSafeAgentId,
  FRAMEWORK_DIR,
  EVENTS_FILE,
  META_FILE,
  AGENTS_DIR,
  AGENT_META_VERSION,
  type StoreFs,
  type AgentMeta,
  type AgentStatus,
  type OpenStoreOptions,
} from './store/index.js'
export { THE_FRAMEWORK_DIR } from './framework-dir.js'
export { gitignorePath, frameworkGitignore, archiveGitignore, SESSIONS_RULE } from './framework-gitignore.js'
export {
  startAgentCommitter,
  commitAgents,
  pendingAgents,
  gitBusy,
  commitMessage,
  nodePathProbe,
  ARCHIVE_PATHSPEC,
  COMMIT_MAX_WAIT_MS,
  type AgentCommitter,
  type AgentCommitterOptions,
  type CommitOutcome,
  type PathProbe,
} from './agent-commit.js'
export {
  theFrameworkDir,
  isActivated,
  nodeProjectFs,
  crawlRepoFiles,
  isGitRepo,
  nodeGitRunner,
  gitTimeoutMs,
  GIT_READ_TIMEOUT_MS,
  GIT_WRITE_TIMEOUT_MS,
  GIT_SLOW_TIMEOUT_MS,
  type ProjectFs,
  type GitRunner,
} from './project.js'
export { CliTimeoutError, isCliTimeout, type CliTimeout } from './cli-exec.js'
export {
  projectId,
  registryPath,
  nodeRegistryFs,
  listProjects,
  addProject,
  removeProject,
  readRegistry,
  readPreferences,
  writePreferences,
  patchPreferences,
  registryPreferencesStore,
  sanitizeCustomPresets,
  REGISTRY_FILE,
  type ProjectRecord,
  type Registry,
  type Preferences,
  type PreferencesStore,
  type CustomPreset,
  type RegistryFs,
} from './registry.js'
export {
  readProjectPresets,
  writeProjectPresets,
  PROJECT_PRESETS_FILE,
} from './project-presets.js'
export {
  installProject,
  enumerateGitRepos,
  nodeDirLister,
  type InstallResult,
  type InstallDeps,
  type DirLister,
  type EnumerateDeps,
} from './install.js'
export {
  PACKAGE_NAME,
  nodeVersionFetcher,
  compareVersions,
  checkForUpdate,
  formatUpdateStatus,
  type VersionFetcher,
  type UpdateStatus,
} from './update-check.js'
export {
  runCli,
  parseArgs,
  agentOptions,
  runOnBeforeMergeable,
  promptAgentSpec,
  type PromptRunner,
  type CliIO,
  type CliArgs,
  type AgentOptions,
} from './cli.js'
export { readAgentSpec, writeAgentSpec, type AgentSpec } from './agent-spec.js'
export { renderOnBeforeMergeablePrompt, ON_BEFORE_MERGEABLE_PROMPT_TEMPLATE, type OnBeforeMergeableContext } from './on-before-mergeable-prompt.js'
export {
  loadFrameworkConfig,
  parseFrameworkConfig,
  FRAMEWORK_CONFIG_FILES,
  type FrameworkFileConfig,
} from './config.js'
export {
  resolveConfigKey,
  resolveAgentConfig,
  fileConfigLayer,
  describeResolvedConfig,
  RUN_CONFIG_DEFAULTS,
  type ConfigLayer,
  type AgentConfigValues,
  type ResolvedAgentConfig,
} from './config-layers.js'
export {
  systemPromptBlock,
  composeAgentSystem,
  renderSystemPrompt,
  SYSTEM_PROMPT_TEMPLATE,
  type SystemPromptOptions,
  type AgentSystemOptions,
  type TfContext,
  type RenderedSystemPrompt,
} from './system-prompt.js'
// Split out of system-prompt.js so the pure composition stays browser-safe (#520);
// re-exported here, so this entry's surface is unchanged.
export { loadUserSystemPrompt, SYSTEM_PROMPT_FILE } from './system-prompt-file.js'
export { renderTemplate, TemplateFragmentError } from './prompt-template.js'
export {
  preflight,
  type PreflightResult,
  type PreflightCheck,
  type PreflightOptions,
  type VersionProbe,
} from './preflight.js'
export { runDaemon, isProcessAlive, EventTailer, DEFAULT_DAEMON_PORT, type DaemonState, type RunDaemonOptions } from './daemon.js'
export {
  appendControl,
  resetControl,
  watchControl,
  controlPath,
  CONTROL_FILE,
  type ControlEntry,
  type ControlWatcher,
} from './control.js'
export { AgentMessageQueue, type AgentMessages } from './agent-messages.js'
export {
  runTodoLoop,
  findTodoBacklog,
  parseTodoEntries,
  insertTodoEntry,
  FLAT_TODO_FILE,
  TICKETS_DIR,
  todoPriorityForTicket,
  DEFAULT_MAX_TODO_ITEMS,
  type TodoBacklog,
  type TodoLoopOptions,
  type TodoLoopResult,
  type TodoLoopReason,
} from './todo-loop.js'
export { agentOptionsFromPreferences, preferencesFromFileConfig } from './agent-options.js'
export {
  startAutoPm,
  AUTO_PM_JOBS,
  AUTO_PM_DRAIN_JOB,
  AUTO_PM_MAINTENANCE_JOB,
  AUTO_PM_ROUTINES,
  autoPmDecision,
  quotaHeadroom,
  DEFAULT_AUTO_PM_INTERVAL_MS,
  DEFAULT_AUTO_PM_COOLDOWN_MS,
  type AutoPmInputs,
  type AutoPmDecision,
  type AutoPmDeps,
  type AutoPmLoop,
  type AutoPmProject,
  type AutoPmJob,
  type AutoPmReport,
  type AutoPmOutcome,
  type AutoPmReporter,
} from './auto-pm.js'
export {
  PRESETS,
  PRESET_DIR,
  presetFilePath,
  presetContext,
  materializePresets,
} from './presets.js'
export { presets, LAUNCHER_PRESETS, type PresetKey } from './preset-catalog.js'
export {
  NOTIFICATION_DEFAULTS,
  notifies,
  notifyMethodEnabled,
  notifyCategoryEnabled,
  type NotifyMethod,
  type NotifyCategory,
} from './preference-defaults.js'
export { interventionKey, pickNewInterventions } from './dashboard/keys.js'
export { definePreset, defaultWhat, DEFAULT_WHAT, type PresetDef, type PresetParam, type PresetRenderContext } from './preset-prompt.js'
export {
  fakeDriver,
  FAKE_INTENT,
} from './fake-script.js'
export {
  DRIVERS,
  DRIVER_SPECS,
  createDriver,
  isDriverName,
  type DriverName,
  type DriverSpec,
  type CreateDriverOptions,
} from './driver-cli.js'
