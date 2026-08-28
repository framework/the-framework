/**
 * The **driver** seam: the one abstraction a coding-agent CLI is wrapped behind.
 * A driver treats the CLI (Claude Code, Codex) as a **black box**: hand it a
 * prompt, let its *own* loop run to completion, then read the code it produced
 * and gate on the outcome.
 *
 * The seam is deliberately the **code and the outcome**, never the agent's
 * individual tool calls (#165): drive by prompting, verify by result, so the
 * wrapped CLI keeps its subscription-based auth and its internal loop stays
 * untouched and swappable.
 *
 * Everything runs *through* the driver: a role is prompt framing
 * ({@link DriverStartOptions.system}), and each pass is a **fresh**
 * {@link DriverSession.prompt} call, so `prompt` is the fresh-context unit.
 *
 * `Driver` is intentionally tiny: `start` a session, `prompt` it, read the code,
 * `dispose` — four moves a second CLI slots in behind.
 */

/**
 * The stable id of one concrete implementation, as recorded on a session's meta. A driver has one
 * per place it can run — `claude-code` locally, `claude-web` in a cloud session, `github-actions`
 * on a runner — which is why this is wider than the user's driver choice.
 */
export type DriverImplId = 'claude-code' | 'claude-web' | 'github-actions' | 'codex' | 'fake'

/** A wrapped coding-agent CLI. Boots {@link DriverSession}s bound to a workspace. */
export interface Driver {
  /**
   * Stable id for this concrete implementation, e.g. `"claude-code"`. Not the driver's *name*
   * (`claude`), which is the user's choice: one driver has an implementation per place it can run —
   * the caller maps it back to the choice.
   */
  readonly id: DriverImplId
  /** Boot a session bound to a workspace directory. */
  start(opts: DriverStartOptions): Promise<DriverSession>
  /**
   * Ask the agent where the account's subscription quota stands (#521), for the
   * consumption limits in #519. Account-wide and independent of any session, so
   * it hangs off the driver rather than off {@link DriverSession}.
   *
   * Optional: an agent that can't report it omits the method entirely, the same
   * way {@link DriverRateLimit} is omitted by drivers that can't emit it.
   */
  readQuota?(opts?: { signal?: AbortSignal }): Promise<DriverQuota>
}

/** How to boot a {@link DriverSession}. */
export interface DriverStartOptions {
  /** Absolute path to the workspace the agent reads and edits. */
  cwd: string
  /**
   * Role framing prepended to every prompt in this session (a role is prompt
   * framing, not a separate kind of agent). Maps to the agent's system prompt.
   */
  system?: string
  /** Model id to pass through when the wrapped agent supports selecting one. */
  model?: string
  /** Abort the whole session; disposing kills the underlying process. */
  signal?: AbortSignal
  /**
   * Resume a prior agent session id (#720): seed the session so its very first
   * prompt (with `resume`) continues that conversation instead of starting fresh.
   * This is how a finished agent is revived from a UI — its captured session
   * id is threaded here so the opening message lands with the full prior context.
   * A driver that can't resume ignores it and runs fresh (the best-effort contract).
   */
  resumeSessionId?: string
  /**
   * Observe the agent's *own* progress as it works. Black-box granularity: we
   * forward these for visibility (a UI) but never branch control flow
   * on them. Isolated: a throwing callback must not break the agent.
   */
  onEvent?: (event: DriverEvent) => void
}

/** A booted agent session, bound to one workspace. */
export interface DriverSession {
  /** Stable id the driver mints for this session. The wrapped CLI's own session id, when it has one, is {@link DriverTurn.sessionId}. */
  readonly id: string
  /** Absolute workspace path the agent is bound to. */
  readonly cwd: string
  /**
   * Send one prompt, let the agent's built-in loop run to completion, and
   * resolve with its final turn. Each call is a **fresh** invocation (fresh
   * context per loop pass) unless a driver documents otherwise.
   */
  prompt(text: string, opts?: DriverPromptOptions): Promise<DriverTurn>
  /**
   * Read a file the agent produced (the seam is the code). Optional: a driver
   * whose workspace is not host-readable may omit it and rely on a runner.
   */
  readCode?(path: string): Promise<string>
  /** Tear the session down (kill the process, free resources). Idempotent. */
  dispose(): Promise<void>
}

/** Per-prompt overrides. */
export interface DriverPromptOptions {
  /** Extra framing for just this prompt, appended after the session `system`. */
  system?: string
  /** Abort just this prompt (the in-flight invocation). */
  signal?: AbortSignal
  /**
   * Continue the agent's *previous* turn instead of starting fresh (#714): the
   * live-chat path resumes the same session so the message lands in the ongoing
   * conversation with full context. Best-effort — a driver that can't resume
   * (or has no prior turn yet) runs a fresh invocation, the normal case. Honored
   * by the Claude Code driver via `--resume <sessionId>`.
   */
  resume?: boolean
}

/** The outcome of one {@link DriverSession.prompt} turn. */
export interface DriverTurn {
  /** The agent's final assistant text for this prompt. */
  text: string
  /** The agent's session id for this turn, when it exposes one: the handle a UI links to. */
  sessionId?: string
  /** Token + cost accounting for this turn, when the agent reports it (#322). */
  usage?: DriverUsage
}

/**
 * Token and cost accounting for one turn, as reported by the wrapped agent (#322).
 * Claude Code emits this on its final `result` line; drivers that cannot report
 * it simply omit it. Costs are whatever the agent computed, in USD.
 *
 * Tokens are the part every agent reports; the price is the part only some do
 * (#540). So `costUsd` is optional and the tokens are not: Codex reports counts
 * and no price, and an agent that can't price a turn reports the tokens it does
 * know rather than nothing at all.
 */
export interface DriverUsage {
  /**
   * Cost of the turn in USD, when the agent prices its own turns. Omitted when it
   * doesn't — never `0`, which would read as free rather than as unknown.
   *
   * Note this is a notional price under a subscription: the user pays a flat fee,
   * and the agent reports what the turn would have cost on metered API pricing.
   * What a subscription actually spends is quota, which {@link DriverQuota}
   * carries and a spending limit (#519) gates on.
   */
  costUsd?: number
  /** Non-cached input tokens. */
  inputTokens: number
  /** Output tokens. */
  outputTokens: number
  /** Tokens read from the prompt cache. */
  cacheReadTokens: number
  /** Tokens written to the prompt cache. */
  cacheCreationTokens: number
}

/**
 * Where the account's subscription quota stands, as reported by the wrapped
 * agent (#517). Claude Code emits one of these per turn on its `stream-json`
 * output; drivers that cannot report it simply omit it. This is the account
 * limit, not this agent's spend — {@link DriverUsage} covers the latter.
 */
export interface DriverRateLimit {
  /**
   * Whether the account may still spend against this window: `allowed`,
   * `allowed_warning`, or `rejected`. Left open rather than a union — only
   * `allowed` has been observed, and a status we don't know is the signal we're
   * capturing for, so it must surface rather than be dropped.
   */
  status: string
  /**
   * Which quota window this reports on (`five_hour`, `seven_day`,
   * `seven_day_opus`, `seven_day_sonnet`, `weekly`). Left open for the same
   * reason: the agent adds windows as plans change.
   */
  window: string
  /** When the window resets, epoch **milliseconds** (the agent reports seconds). */
  resetsAt: number
}

/**
 * One quota window and how much of it the account has burned (#521).
 *
 * The three concepts here are easy to confuse. {@link DriverUsage} is what *this
 * run* spent. {@link DriverRateLimit} is a per-turn traffic light (are we still
 * allowed to spend, and when does the window reset). This is the missing middle:
 * the *proportion* of a window consumed, which is the only one of the three that
 * can fill a progress bar.
 */
export interface DriverQuotaWindow {
  /** The window's name exactly as the agent phrased it, e.g. `"Current session"`. */
  label: string
  /**
   * Normalized window, so callers can gate without matching on prose.
   * `session` is Claude's 5-hour window, `week` its all-models week, and
   * `week-model` a single model's week (Opus/Sonnet get their own).
   *
   * Note there is deliberately no `day`: Claude measures a 5-hour session and a
   * week, and nothing per day.
   */
  kind: 'session' | 'week' | 'week-model' | 'unknown'
  /** How much of the window is gone, 0-100. */
  percentUsed: number
  /**
   * When the window resets, as the agent worded it (`"Jul 18 at 7am
   * (Asia/Jerusalem)"`). Prose, not a timestamp: the agent prints no year, so
   * parsing it to an epoch would be guesswork. {@link DriverRateLimit.resetsAt}
   * carries the exact epoch for the window it reports on.
   */
  resetsAtText?: string
}

/**
 * Why a quota read came back empty.
 *
 * The split that matters is transient vs authoritative. `fetch-failed`,
 * `timeout` and `unrecognized` describe *this attempt* (the agent's own usage
 * fetch can be refused upstream, with a penalty window), so a recent reading is
 * still worth showing and asking again may work. The remaining reasons describe
 * the account or the install and are a statement about the setup, so a retained
 * reading must not outlive them.
 */
export type DriverQuotaUnavailableReason =
  /** The agent's own usage fetch failed, e.g. refused upstream. Transient. */
  | 'fetch-failed'
  /** The agent did not answer in time. Transient. */
  | 'timeout'
  /** The agent binary isn't installed or isn't on `PATH`. */
  | 'agent-not-found'
  /** The account has no subscription quota to report (e.g. API-key auth). */
  | 'no-subscription'
  /**
   * The agent answered, but not in a shape we recognize (it reworded the readout).
   *
   * Transient, because it describes one answer rather than the install: an
   * update notice printed ahead of the JSON, or empty stdout while the CLI
   * swaps itself under a long-lived process, both land here and both are gone by
   * the next read (#960).
   */
  | 'unrecognized'

/** Whether a {@link DriverQuotaUnavailableReason} describes this attempt rather than the setup. */
export function isTransientQuotaReason(reason: DriverQuotaUnavailableReason): boolean {
  return reason === 'fetch-failed' || reason === 'timeout' || reason === 'unrecognized'
}

/**
 * Where the account's subscription quota stands (#521), as a whole reading.
 *
 * Modelled as available-or-not rather than as an empty window list, so a caller
 * can't mistake "we couldn't ask" for "nothing is used".
 */
export type DriverQuota =
  | { available: true; windows: DriverQuotaWindow[] }
  | { available: false; reason: DriverQuotaUnavailableReason }

/**
 * A black-box progress event from the wrapped agent. A caller shows these for
 * visibility but never gates on them: the gate is the code and the outcome, not
 * which tool the agent reached for.
 */
export type DriverEvent =
  /** A prompt was sent; the agent's loop is starting. */
  | { type: 'start'; prompt: string }
  /**
   * The agent announced its session id, at the start of the turn (#1322). `result` repeats it,
   * but a turn that never settles — a manual Stop, an error, a kill — used to take the id down
   * with it, and with it the agent's `claude --resume` handle. A caller records this one rather
   * than showing it: the id is plumbing, not conversation.
   */
  | { type: 'session'; sessionId: string }
  /** An assistant text chunk streamed out. */
  | { type: 'text'; text: string }
  /** The agent used a tool. We surface the name only, not the arguments. */
  | { type: 'action'; label: string }
  /**
   * The turn settled with this final text. `sessionLink` is the real URL of the session,
   * for a driver whose session has one of its own (#1317) — a cloud session, say — so a
   * caller can link there instead of the generic entry point; drivers without one omit it.
   * `anchorSha` is the hand-off anchor commit (#1601), for a driver whose session does its
   * work on a branch of its own naming that this machine can only recognize later by
   * ancestry; drivers whose work stays on the designated branch omit it.
   */
  | { type: 'result'; text: string; sessionId?: string; sessionLink?: string; anchorSha?: string; usage?: DriverUsage }
  /** Where the account's subscription quota stands (#517). */
  | { type: 'rate-limit'; limit: DriverRateLimit }
  /** The agent (or its transport) errored. */
  | { type: 'error'; message: string }
  /** Something the driver worked around, worth telling the user about (#778). */
  | { type: 'notice'; message: string }
