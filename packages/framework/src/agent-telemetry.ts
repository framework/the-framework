import type { Driver, DriverEvent } from './driver/index.js'
import { hasSessionIdPlaceholder, resolveSessionLink } from './session-link.js'
import { type FrameworkEvent } from './events.js'
import { UsageMeter } from './usage.js'

// The telemetry both entry paths share. A build (`run.ts`) and a direct prompt
// (`prompt-run.ts`) differ in what they *do* with the agent, but the accounting around
// it is the same: name the session, follow the driver's event stream, total the usage,
// and stop the agent when it has spent too much (#322) or the account's quota ran out
// (#529). This lived twice, byte-identical, which is how the backlog loop ended up
// without a copy of the sibling turn-signal parsing at all (#563).

/** Inputs to {@link emitSessionStart}. */
export interface SessionStartOptions {
  emit: (event: FrameworkEvent) => void
  driver: Driver
  /** The workspace the agent works in. */
  cwd: string
  /** The session link, literal or templated with `{sessionId}`. */
  sessionLink?: string | undefined
  /** The model id the driver was started with (#1438), recorded on the event per leg. */
  model?: string | undefined
}

/**
 * Emit the agent's opening `session` event. A literal link is shown right away; a
 * templated one (`.../{sessionId}`) can only resolve once the driver reports its
 * session id, so it waits for the `session-update` from {@link createDriverEventHandler}.
 */
export function emitSessionStart(opts: SessionStartOptions): void {
  const literal = opts.sessionLink && !hasSessionIdPlaceholder(opts.sessionLink) ? opts.sessionLink : undefined
  opts.emit({
    kind: 'session',
    driver: opts.driver.id,
    workspace: opts.cwd,
    fake: opts.driver.id === 'fake',
    ...(literal ? { sessionLink: literal } : {}),
    ...(opts.model ? { model: opts.model } : {}),
  })
}

/** Inputs to {@link createDriverEventHandler}. */
export interface DriverEventHandlerOptions {
  emit: (event: FrameworkEvent) => void
  /** The session link template, when the caller configured one. */
  sessionLink?: string | undefined
}

/** What {@link createDriverEventHandler} hands back. */
export interface DriverEventHandler {
  /** Wire this as the driver session's `onEvent`. */
  onDriverEvent: (event: DriverEvent) => void
}

/**
 * Watch the driver's black box (#165) and turn it into the agent's stream: surface the real session
 * id as `session-update` once known (that is the honest handle a UI links to, and it changes per
 * prompt, so re-emit), and fold each turn's usage into the agent total.
 *
 * It used to trip two self-stops here as well — a per-agent USD cap and a mid-run quota gate — each
 * firing *after* the turn that crossed it, when its cost was already spent (E1).
 */
export function createDriverEventHandler(opts: DriverEventHandlerOptions): DriverEventHandler {
  const { emit } = opts
  let lastSessionId: string | undefined
  const usage = new UsageMeter()

  const onDriverEvent = (event: DriverEvent): void => {
    // The turn-start id announcement (#1322) is consumed here, not forwarded: it exists so the
    // `session-update` below lands before a Stop or a crash can lose the turn, and a transcript
    // row repeating an id the very next event also carries would only be noise.
    if (event.type === 'session') {
      if (event.sessionId !== lastSessionId) {
        lastSessionId = event.sessionId
        const link = opts.sessionLink ? resolveSessionLink(opts.sessionLink, event.sessionId) : undefined
        emit({ kind: 'session-update', sessionId: event.sessionId, ...(link ? { sessionLink: link } : {}) })
      }
      return
    }
    emit({ kind: 'driver', event })
    if (event.type !== 'result') return
    // The hand-off anchor (#1601) reaches the meta the same way the session id does: it is a
    // fact about the run the daemon needs after this process is gone, so only an event carries it.
    if (event.anchorSha) emit({ kind: 'cloud-anchor', sha: event.anchorSha })
    if (event.sessionId && event.sessionId !== lastSessionId) {
      lastSessionId = event.sessionId
      // A driver that knows its session's real URL (#1317, the cloud hand-off) beats the
      // session-link template, whose Claude default is the generic entry point.
      const link = event.sessionLink ?? (opts.sessionLink ? resolveSessionLink(opts.sessionLink, event.sessionId) : undefined)
      emit({ kind: 'session-update', sessionId: event.sessionId, ...(link ? { sessionLink: link } : {}) })
    }
    if (!event.usage) return
    usage.add(event.usage)
    const totals = usage.totals()
    emit({ kind: 'usage', ...totals })
  }

  return { onDriverEvent }
}

/** Inputs to {@link createAgentControls}. */
export interface AgentControlsOptions {
  emit: (event: FrameworkEvent) => void
  /** The caller's abort signal (Stop button / Ctrl+C / control channel), if any. */
  signal?: AbortSignal | undefined
  sessionLink?: string | undefined
}

/** The agent's abort plumbing plus its driver-event sink. */
export interface AgentControls extends DriverEventHandler {
  /** The composed signal every driver turn runs under: the caller's, or the answer's. */
  agentSignal: AbortSignal
  /** Trips a clean stop when the user answers a gate with a `stop` option (#358). */
  answerController: AbortController
}

/**
 * Compose the agent's signal and wire its driver-event handler in one place. The caller's signal is
 * OR'd (via {@link AbortSignal.any}) with the one self-stop left — an answer that says to stop
 * (#358) — so anything downstream that watches `agentSignal` stops the same way regardless of which
 * fired.
 *
 * There were three (E1). A per-agent USD cap and a mid-run quota gate also aborted a session that
 * was already going, which is the worst moment to economise: the tokens are already spent, the
 * work is half-done, and what is saved is the cheap part while what is lost is the expensive part.
 * Spending is decided once, before a session starts.
 *
 * What survives is the one a *person* asked for. It used to be reached through the gate's kind —
 * a decline of an `await-confirmation` — and now through the option the agent marked, which is
 * the same stop with the plan-approval special case taken out of it (D6).
 */
export function createAgentControls(opts: AgentControlsOptions): AgentControls {
  const answerController = new AbortController()
  const agentSignal = AbortSignal.any([...(opts.signal ? [opts.signal] : []), answerController.signal])
  const handler = createDriverEventHandler({ emit: opts.emit, sessionLink: opts.sessionLink })
  return { ...handler, agentSignal, answerController }
}

/** Inputs to {@link endStopDetail}. */
export interface StopDetailOptions {
  /** The error the agent's turn loop threw. */
  err: unknown
  /** The caller's own signal, to tell a caller stop from a self-stop. */
  signal?: AbortSignal | undefined
  /** The gate-answer stop (#358), which is a stop rather than a failure however it surfaced. */
  answerController: AbortController
}

/**
 * Classify why an agent's turn loop threw and render the `end` event's `detail`. A caller interrupt
 * or an answer that said to stop (#358) are clean stops; anything else is a real failure. Shared
 * so the two agent paths can never disagree on what "stopped" means.
 */
export function endStopDetail(opts: StopDetailOptions): { stopped: boolean; detail: string } {
  const callerAborted = opts.signal?.aborted === true
  const answered = opts.answerController.signal.aborted
  const detail = answered ? 'stopped by your answer' : opts.err instanceof Error ? opts.err.message : String(opts.err)
  return { stopped: callerAborted || answered, detail }
}
