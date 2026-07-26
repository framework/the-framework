import type { BridgeQuestion } from './bridge-endpoints.js'

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

  /** The last contact, or undefined if nothing has ever reached the bridge. */
  lastContact(): BridgeContact | undefined {
    return this.contact
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
