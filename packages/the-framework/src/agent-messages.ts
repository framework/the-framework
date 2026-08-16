/**
 * The live-chat message channel (#714): the user's own turns into a running run.
 *
 * A run's await gates (#337) are the agent asking the user; this is the reverse —
 * the user speaking to the agent unprompted. Each message continues the *same*
 * agent session (`claude --resume <id>`), so the conversation keeps its full
 * context. The run loop drains this once the work settles; a daemon-spawned
 * session then ends itself when the queue is idle (#1390) — a follow-up message
 * reopens the conversation via `--resume`, like Claude Code web — while a run
 * with its own terminal dashboard keeps the old stay-open wait, since that
 * surface has no daemon to resume through.
 *
 * Wired only when an interactive channel can deliver messages (a live dashboard /
 * daemon over `control.jsonl`). A headless run gets no {@link AgentMessages}, so its
 * loop ends when the agent stops asking — byte-identical to before this existed.
 */

/**
 * One user chat message, plus the surface it arrived through (#917).
 */
export interface ChatMessage {
  text: string
}

/** A source of user chat messages for a running run. */
export interface AgentMessages {
  /**
   * The next user message. Returns an already-queued message immediately (drain
   * between turns); otherwise waits for one (stay-open). Resolves `undefined` when
   * the run should stop waiting — the signal aborted (Stop / budget cap) or the
   * source was closed — so the loop ends cleanly rather than hanging.
   */
  next(signal?: AbortSignal): Promise<ChatMessage | undefined>
  /**
   * The next user message only if one has already arrived — never waits (#1390). What the
   * end-of-run drain asks: a queued follow-up is processed, an idle queue ends the session.
   * `undefined` once closed, so an aborted run never starts a new turn off a stale message.
   */
  takeQueued(): ChatMessage | undefined
}

/**
 * A {@link AgentMessages} the control channel feeds ({@link push}) and the run loop
 * drains ({@link next}). A message that arrives with a waiter parked hands off
 * directly; otherwise it queues until the next `next()`. FIFO in both directions.
 */
export class AgentMessageQueue implements AgentMessages {
  private readonly pending: ChatMessage[] = []
  private readonly waiters: Array<(message: ChatMessage | undefined) => void> = []
  private closed = false

  /** Enqueue a user message (or hand it to a parked waiter). No-op once closed. */
  push(text: string): void {
    if (this.closed) return
    const message: ChatMessage = { text }
    const waiter = this.waiters.shift()
    if (waiter) waiter(message)
    else this.pending.push(message)
  }

  /** Stop the chat: wake every parked waiter with `undefined` so their loops end. */
  close(): void {
    this.closed = true
    let waiter: ((message: ChatMessage | undefined) => void) | undefined
    while ((waiter = this.waiters.shift())) waiter(undefined)
  }

  takeQueued(): ChatMessage | undefined {
    if (this.closed) return undefined
    return this.pending.shift()
  }

  next(signal?: AbortSignal): Promise<ChatMessage | undefined> {
    const queued = this.pending.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    if (this.closed || signal?.aborted) return Promise.resolve(undefined)
    return new Promise<ChatMessage | undefined>(resolve => {
      const waiter = (message: ChatMessage | undefined): void => {
        if (signal) signal.removeEventListener('abort', onAbort)
        resolve(message)
      }
      const onAbort = (): void => {
        const i = this.waiters.indexOf(waiter)
        if (i >= 0) this.waiters.splice(i, 1)
        resolve(undefined)
      }
      this.waiters.push(waiter)
      if (signal) signal.addEventListener('abort', onAbort, { once: true })
    })
  }
}
