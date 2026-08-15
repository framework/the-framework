/**
 * The run's own vocabulary, absorbed from `@gemstack/ai-autopilot` and `@gemstack/ai-sdk` when
 * those packages were deleted (A1/A2).
 *
 * What survived is only what the run still speaks: a build turn is modelled as a one-subtask
 * supervised run, so the driver's summary and token usage have a shape to travel in, and the
 * dashboard, store and terminal read the run's scope, progress and completion off the same
 * events they always did.
 */

/** Token counts for one turn. */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** A unit of work dispatched to the agent. */
export interface Subtask {
  /** Stable id; auto-assigned (`subtask-N`) when omitted. */
  id?: string
  /** What the subtask asks for — becomes the agent's prompt. */
  description: string
}

/** A subtask with its id resolved — what actually runs. */
export type PlannedSubtask = Subtask & { id: string }

/** The outcome of dispatching a single subtask. */
export interface SubtaskResult {
  subtask: PlannedSubtask
  /** The agent's final text. Empty string when it failed. */
  text: string
  /** `false` when the agent threw or paused. */
  ok: boolean
  /** The failure, when `ok` is false. */
  error?: unknown
  /** Token usage for this turn (zeroed on failure). */
  usage: TokenUsage
}

/** The full result of a supervised run. */
export interface SupervisorRun {
  /** The synthesized final answer. */
  text: string
  /** The plan that was executed. */
  plan: PlannedSubtask[]
  /** One result per dispatched subtask, in plan order. */
  results: SubtaskResult[]
  /** Aggregate token usage across the dispatched subtasks. */
  usage: TokenUsage
  /** True when a guardrail stopped work early. */
  stoppedEarly: boolean
}

/** Progress within a supervised run. */
export type SupervisorEvent =
  | { type: 'plan'; task: string; subtasks: PlannedSubtask[] }
  | { type: 'plan-trimmed'; kept: number; dropped: number; reason: 'maxSubtasks' }
  | { type: 'dispatch-start'; subtask: PlannedSubtask }
  | { type: 'dispatch-result'; result: SubtaskResult }
  | { type: 'budget-exceeded'; spentTokens: number; limitTokens: number; skipped: number }
  | { type: 'synthesize'; results: SubtaskResult[] }

/** How much app to build. */
export type BootstrapScope = 'prototype' | 'full'

/** Which phase a narration line belongs to. */
export type BootstrapPhase = 'scope' | 'build'

/**
 * What the run narrates. Trimmed with the spine (A3): the `checklist`, `improve` and `deploy`
 * variants went with the review loop (A5) and the deploy phase (A4), leaving the two phases a
 * run actually has.
 */
export type BootstrapEvent =
  | { type: 'scope'; scope: BootstrapScope; intent: string }
  | { type: 'narrate'; phase: BootstrapPhase; message: string }
  | { type: 'build'; event: SupervisorEvent }
  | { type: 'done'; result: BootstrapResult }

/** The outcome of a run. */
export interface BootstrapResult {
  scope: BootstrapScope
  intent: string
  /** The build's supervised run. */
  run: SupervisorRun
}

/** Context handed to the build step. */
export interface BuildContext {
  scope: BootstrapScope
  intent: string
  /** Forward each supervisor event here so the run can narrate the build. */
  onEvent: (event: SupervisorEvent) => void
  signal?: AbortSignal
}
