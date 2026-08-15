import type { Driver, DriverEvent } from './driver/index.js'
import { hasSessionIdPlaceholder, resolveSessionLink } from './session-link.js'
import { type FrameworkEvent } from './events.js'
import { UsageMeter } from './usage.js'

// The telemetry both entry paths share. A build (`run.ts`) and a direct prompt
// (`prompt-run.ts`) differ in what they *do* with the agent, but the accounting around
// it is the same: name the session, follow the driver's event stream, total the usage,
// and stop the run when it has spent too much (#322) or the account's quota ran out
// (#529). This lived twice, byte-identical, which is how the backlog loop ended up
// without a copy of the sibling turn-signal parsing at all (#563).

/** Inputs to {@link emitSessionStart}. */
export interface SessionStartOptions {
  emit: (event: FrameworkEvent) => void
  driver: Driver
  /** The workspace the run works in. */
  cwd: string
  /** The session link, literal or templated with `{sessionId}`. */
  sessionLink?: string | undefined
  /** The model id the driver was started with (#1438), recorded on the event per leg. */
  model?: string | undefined
}

/**
 * Emit the run's opening `session` event. A literal link is shown right away; a
 * templated one (`.../{sessionId}`) can only resolve once the driver reports its
 * session id, so it waits for the `session-update` from {@link createDriverEventHandler}.
 */
export function emitSessionStart(opts: SessionStartOptions): void {
  const literal = opts.sessionLink && !hasSessionIdPlaceholder(opts.sessionLink) ? opts.sessionLink : undefined
  opts.emit({
    kind: 'session',
    driver: opts.driver.name,
    workspace: opts.cwd,
    fake: opts.driver.name === 'fake',
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
 * Watch the driver's black box (#165) and turn it into the run's stream: surface the real session
 * id as `session-update` once known (that is the honest handle a UI links to, and it changes per
 * prompt, so re-emit), and fold each turn's usage into the run total.
 *
 * It used to trip two self-stops here as well — a per-run USD cap and a mid-run quota gate — each
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
    if (event.sessionId && event.sessionId !== lastSessionId) {
      lastSessionId = event.sessionId
      // A driver that knows its session's real URL (#1317, the cloud hand-off) beats the
      // `--session-link` template, whose Claude default is the generic entry point.
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

/** Inputs to {@link createRunControls}. */
export interface RunControlsOptions {
  emit: (event: FrameworkEvent) => void
  /** The caller's abort signal (Stop button / Ctrl+C / control channel), if any. */
  signal?: AbortSignal | undefined
  sessionLink?: string | undefined
}

/** The run's abort plumbing plus its driver-event sink. */
export interface RunControls extends DriverEventHandler {
  /** The composed signal every driver turn runs under. */
  runSignal: AbortSignal
  /** Trips a clean stop when the user declines a plan (#358); inert on the direct path. */
  declineController: AbortController
}

/**
 * Compose the run's signal and wire its driver-event handler in one place. The caller's signal is
 * OR'd (via {@link AbortSignal.any}) with the one self-stop left — a declined plan (#358) — so
 * anything downstream that watches `runSignal` stops the same way regardless of which fired.
 *
 * There were three (E1). A per-run USD cap and a mid-run quota gate also aborted a session that
 * was already going, which is the worst moment to economise: the tokens are already spent, the
 * work is half-done, and what is saved is the cheap part while what is lost is the expensive part.
 * Spending is decided once, before a session starts.
 */
export function createRunControls(opts: RunControlsOptions): RunControls {
  const declineController = new AbortController()
  const runSignal = AbortSignal.any([...(opts.signal ? [opts.signal] : []), declineController.signal])
  const handler = createDriverEventHandler({ emit: opts.emit, sessionLink: opts.sessionLink })
  return { ...handler, runSignal, declineController }
}

/** Inputs to {@link endStopDetail}. */
export interface StopDetailOptions {
  /** The error the run's turn loop threw. */
  err: unknown
  /** The caller's own signal, to tell a caller stop from a self-stop. */
  signal?: AbortSignal | undefined
  declineController: AbortController
}

/**
 * Classify why a run's turn loop threw and render the `end` event's `detail`. A caller interrupt
 * or a declined plan (#358) are clean stops; anything else is a real failure. Shared so the two
 * run paths can never disagree on what "stopped" means.
 */
export function endStopDetail(opts: StopDetailOptions): { stopped: boolean; detail: string } {
  const callerAborted = opts.signal?.aborted === true
  const declined = opts.declineController.signal.aborted
  const detail = declined ? 'plan declined' : opts.err instanceof Error ? opts.err.message : String(opts.err)
  return { stopped: callerAborted || declined, detail }
}
