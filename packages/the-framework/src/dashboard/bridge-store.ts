import { randomUUID } from 'node:crypto'
import type { BridgeEvent, BridgeHello, BridgeQuestion } from './bridge-endpoints.js'

/**
 * An answer picked in the dashboard, on its way back to the session (#1237).
 *
 * `queued` until the extension fetches it, delivers it into the composer and acknowledges;
 * then `sent`, or `failed` with the extension's reason. The id is what the acknowledgement
 * references, so a stale ack from a tab that died mid-delivery cannot resolve a newer answer.
 */
export interface BridgeAnswer {
  id: string
  sessionId: string
  label: string
  queuedAt: string
  state: 'queued' | 'sent' | 'failed'
  note?: string
}

/** Most transcript entries kept per session, oldest dropped first. */
const MAX_SESSION_EVENTS = 300

/**
 * The questions a Claude web session is parked on, keyed by its cloud session id (#1237).
 *
 * A cloud agent has no live local session to hang a choice gate on: #1231 ends the agent at the
 * hand-off, so by the time the agent asks anything the agent is already `done`. The join back to
 * an agent is `AgentMeta.sessionId`, which a web agent already carries because `CloudSession` reports
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

  private readonly answersBySession = new Map<string, BridgeAnswer>()
  /** The fingerprint of the question each session's `sent` answer resolved. */
  private readonly answeredBySession = new Map<string, string>()

  /**
   * Record the question a session is parked on, replacing any earlier one for that session.
   *
   * A question identical to one an answer was already delivered for is dropped: the extension's
   * worker forgets what it sent when it restarts, and the answered block stays in the page's DOM,
   * so the same question would otherwise resurface as parked right after being answered.
   */
  record(question: BridgeQuestion): void {
    if (this.answeredBySession.get(question.sessionId) === fingerprint(question)) return
    const previous = this.bySession.get(question.sessionId)
    // A genuinely new question means the session moved on: an undelivered pick for the old one
    // must not be typed into it, and a resolved one no longer says anything about this question.
    // Only a re-report of the question currently parked keeps its queued answer alive.
    if (!previous || fingerprint(previous) !== fingerprint(question)) {
      this.answersBySession.delete(question.sessionId)
      this.answeredBySession.delete(question.sessionId)
    }
    this.bySession.set(question.sessionId, question)
  }

  /**
   * Queue an answer picked in the dashboard (#1237). Refuses anything but a label of the
   * question currently parked, so the only text this can ever put in a composer is one the
   * session itself offered.
   */
  queueAnswer(sessionId: string, label: string): BridgeAnswer | string {
    const question = this.bySession.get(sessionId)
    if (!question) return 'that session has no parked question'
    if (!question.options.some(option => option.label === label)) return 'that label is not one of the question options'
    const answer: BridgeAnswer = { id: randomUUID(), sessionId, label, queuedAt: new Date().toISOString(), state: 'queued' }
    this.answersBySession.set(sessionId, answer)
    return answer
  }

  /** Withdraw a queued answer. Too late once the extension has delivered it. */
  cancelAnswer(sessionId: string): boolean {
    const answer = this.answersBySession.get(sessionId)
    if (!answer || answer.state !== 'queued') return false
    this.answersBySession.delete(sessionId)
    return true
  }

  /** The answer waiting for the extension to deliver, if any. */
  pendingAnswer(sessionId: string): BridgeAnswer | undefined {
    const answer = this.answersBySession.get(sessionId)
    return answer?.state === 'queued' ? answer : undefined
  }

  /** The session's answer in whatever state, for the dashboard to render. */
  answer(sessionId: string): BridgeAnswer | undefined {
    return this.answersBySession.get(sessionId)
  }

  /**
   * The extension's word on what happened to a delivery. On success the question is resolved:
   * it is dropped, and re-reports of the same block are ignored (see {@link record}).
   */
  resolveAnswer(sessionId: string, id: string, ok: boolean, note?: string): void {
    const answer = this.answersBySession.get(sessionId)
    if (!answer || answer.id !== id || answer.state !== 'queued') return
    this.answersBySession.set(sessionId, { ...answer, state: ok ? 'sent' : 'failed', ...(note ? { note } : {}) })
    if (!ok) return
    const question = this.bySession.get(sessionId)
    if (question) this.answeredBySession.set(sessionId, fingerprint(question))
    this.bySession.delete(sessionId)
  }

  /** The question that session is parked on, if the bridge has reported one. */
  get(sessionId: string): BridgeQuestion | undefined {
    return this.bySession.get(sessionId)
  }

  /** Every parked question, newest first. */
  list(): BridgeQuestion[] {
    return [...this.bySession.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  }

  /** Drop a session's question, once it is answered or its agent is gone. */
  clear(sessionId: string): void {
    this.bySession.delete(sessionId)
    this.eventsBySession.delete(sessionId)
    this.answersBySession.delete(sessionId)
    this.answeredBySession.delete(sessionId)
  }
}

/** What makes two reports the same question: the text shown, not when it arrived. */
function fingerprint(question: BridgeQuestion): string {
  return JSON.stringify([question.title, question.options, question.recommended ?? null])
}

/**
 * The daemon's one store. A module singleton rather than a {@link DashboardContext} field
 * because both ends live in the same process but reach it by different routes: the bridge
 * endpoint writes from the raw HTTP handler, and the dashboard reads from an RPC, which is
 * handed only what the wired context carries.
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
