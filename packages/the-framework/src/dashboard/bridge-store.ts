import type { BridgeEvent, BridgeHello, BridgeQuestion } from './bridge-endpoints.js'

/** Most transcript entries kept per session, oldest dropped first. */
export const MAX_SESSION_EVENTS = 300

/**
 * The questions a Claude web session is parked on, keyed by its cloud session id (#1237).
 *
 * A cloud run has no live local session to hang a choice gate on: #1231 ends the run at the
 * hand-off, so by the time the agent asks anything the run is already `done`. The join back to
 * a run is `RunMeta.sessionId`, which a web run already carries because `CloudSession` reports
 * the cloud id on its result.
 *
 * In memory on purpose. A question is only answerable while the session that asked it is still
 * parked, and the bridge that reported it re-reports on reconnect, so surviving a daemon restart
 * would preserve a question that may already have been answered elsewhere.
 */
/** The last time anything spoke to the bridge, and how it went. */
export interface BridgeContact {
  at: string
  route: string
  status: number
}

export class BridgeQuestions {
  private readonly bySession = new Map<string, BridgeQuestion>()
  private contact: BridgeContact | undefined

  /**
   * Note that something reached the bridge, whatever the outcome.
   *
   * Failures are recorded too, and that is the point: an extension that is misconfigured looks
   * exactly like one that is not installed, because both leave no question behind. A refused
   * request at least proves something is trying.
   */
  recordContact(route: string, status: number): void {
    this.contact = { at: new Date().toISOString(), route, status }
  }

  private helloState: BridgeHello | undefined

  /** What the injected page script last said about itself. */
  recordHello(hello: BridgeHello): void {
    this.helloState = hello
  }

  /** The page script's last report, or undefined if none has ever arrived. */
  hello(): BridgeHello | undefined {
    return this.helloState
  }

  /** The last contact, or undefined if nothing has ever reached the bridge. */
  lastContact(): BridgeContact | undefined {
    return this.contact
  }

  private readonly eventsBySession = new Map<string, Map<number, BridgeEvent>>()

  /**
   * Record one transcript entry, keyed by its position.
   *
   * Keyed rather than appended because the page is re-read on every DOM change, so the same
   * message arrives repeatedly and a growing list would be mostly duplicates. Position also lets
   * a later read replace an earlier one, which is what a message still being streamed needs.
   */
  recordEvent(event: BridgeEvent): void {
    let bySeq = this.eventsBySession.get(event.sessionId)
    if (!bySeq) {
      bySeq = new Map()
      this.eventsBySession.set(event.sessionId, bySeq)
    }
    bySeq.set(event.seq, event)
    // Bound it: a long session would otherwise grow without limit in a daemon that never restarts.
    if (bySeq.size > MAX_SESSION_EVENTS) {
      for (const seq of [...bySeq.keys()].sort((a, b) => a - b).slice(0, bySeq.size - MAX_SESSION_EVENTS)) bySeq.delete(seq)
    }
  }

  /** That session's transcript so far, in order. */
  events(sessionId: string): BridgeEvent[] {
    return [...(this.eventsBySession.get(sessionId)?.values() ?? [])].sort((a, b) => a.seq - b.seq)
  }

  /** Record the question a session is parked on, replacing any earlier one for that session. */
  record(question: BridgeQuestion): void {
    this.bySession.set(question.sessionId, question)
  }

  /** The question that session is parked on, if the bridge has reported one. */
  get(sessionId: string): BridgeQuestion | undefined {
    return this.bySession.get(sessionId)
  }

  /** Every parked question, newest first. */
  list(): BridgeQuestion[] {
    return [...this.bySession.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  }

  /** Drop a session's question, once it is answered or its run is gone. */
  clear(sessionId: string): void {
    this.bySession.delete(sessionId)
    this.eventsBySession.delete(sessionId)
  }
}

/**
 * The daemon's one store. A module singleton rather than a {@link DashboardContext} field
 * because both ends live in the same process but reach it by different routes: the bridge
 * endpoint writes from the raw HTTP handler, and the dashboard reads from a telefunction,
 * which cannot be handed anything the request did not carry.
 */
let instance: BridgeQuestions | undefined

export function bridgeQuestions(): BridgeQuestions {
  if (!instance) instance = new BridgeQuestions()
  return instance
}

/** Replace the store. Tests only: a module singleton would otherwise leak between them. */
export function resetBridgeQuestions(): void {
  instance = undefined
}
