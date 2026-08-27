import type { Driver, DriverSession } from 'agent-driver'
import { composeAgentSystem, renderSystemPrompt, type TfContext } from './system-prompt.js'
import { createAgentControls, emitSessionStart, endStopDetail } from './agent-telemetry.js'
import { createTurnSignalEmitter } from './turn-gate.js'
import { runAwaitRounds } from './await-gate.js'
import { runTodoLoop, type TodoLoopResult } from './todo-loop.js'
import { type ChoicePick, type ChoiceRequest, type FrameworkEvent } from './events.js'
import type { AgentMessages } from './agent-messages.js'
import { isHandsOff, type AgentLocation } from './agent-location.js'

/**
 * One session: frame the wrapped agent, send it a prompt, honor the gates it answers with, and
 * stream every step as a {@link FrameworkEvent}. Reversible — swap in a different `Driver`
 * without touching this wiring.
 *
 * There used to be two of these. `runFramework` drove a build through ai-autopilot's `Bootstrap`
 * spine, and `runPrompt` ran one prompt verbatim; `composeAgentSystem` exists specifically because
 * the two each inlined the system composition and drifted apart (#500/#501). Once the review loop
 * (A5) and the `Bootstrap` spine (A3) went, the build path *was* "one prompt, honoring gates" —
 * which is what the prompt path already was. What is left of the difference is two options rather
 * than two implementations: which prompt opens the session, and whether the agent's own backlog is
 * worked afterwards.
 */

/** What a session is: an intent to build from, or a prompt to run verbatim. */
export type AgentKind = 'build' | 'prompt'

/** Options for {@link runAgent}. */
export interface RunAgentOptions {
  /**
   * What the session is asked to do. For `build`, the intent the opening prompt is composed
   * around; for `prompt`, the text sent as-is (modulo the system template's user slot).
   */
  prompt: string
  /** Which opening prompt this session gets, and whether the backlog loop follows. Default `build`. */
  kind?: AgentKind
  /**
   * Where this session's turns execute (#1050/#610). Default `local`. Only `web` hands the work
   * somewhere this machine cannot follow, which makes the opening prompt the whole session —
   * see {@link isHandsOff}.
   */
  location?: AgentLocation
  /** The agent runs in a checkout The Framework created, with `branch-management` on its PATH (#1725). */
  ownedCheckout?: boolean
  /** The wrapped coding agent. */
  driver: Driver
  /** Absolute workspace path the agent works in. */
  cwd: string
  /** Model id to pass through to the driver. */
  model?: string
  /**
   * A user-authored system prompt (from `SYSTEM.md`) injected into every prompt
   * (#301). Load with `loadUserSystemPrompt(cwd)`. Composed after the built-in
   * #326 system prompt, so a repo can add its own instructions on top of the default.
   */
  systemPrompt?: string
  /** Remove the built-in #326 system prompt (#301/C3). Default `false` — it is included. */
  vanilla?: boolean
  /** This session has a real browser (#824), so the system channel says so. */
  browser?: boolean
  /** Transparent mode (#625): empty the system channel entirely (raw `claude -p`); overrides vanilla. */
  transparent?: boolean
  /** In-context directories (#439): added as one `Context:` line to the system prompt. */
  context?: readonly string[]
  /**
   * A link to the live agent session, shown on the dashboard. Either a literal
   * URL, or a template with `{sessionId}` (see {@link SESSION_ID_PLACEHOLDER})
   * that resolves once the wrapped agent reports its real id via `session-update`.
   */
  sessionLink?: string
  /** Interrupt the session between turns. */
  signal?: AbortSignal
  /**
   * Pause on an interactive choice and await a pick (#304). Called when a turn stops to ask
   * (#337/#358): the session emits a `choice` event, calls this, and resumes on the returned
   * option. Omit for a headless session: the gate then auto-accepts the recommended option
   * without pausing. The CLI wires this to the dashboard's Accept button.
   */
  requestChoice?: (req: ChoiceRequest) => Promise<ChoicePick>
  /**
   * Work the agent's own `TODO_AGENTS.md` backlog after the opening exchange settles (#323), one
   * gated entry per turn until it is empty. Default: on for a `build` session with a real driver,
   * off otherwise (a `prompt` session is one prompt by definition, and the fake driver's scripted
   * demo writes no backlog and must stay deterministic). Set explicitly to force either way.
   */
  todoLoop?: boolean
  /**
   * Continue a stopped session's conversation (#720/#1467): the captured agent session id to
   * `--resume`. When set, {@link prompt} is sent verbatim as a continuation message rather than
   * composed — the resumed transcript already carries the framing, which is exactly why #782
   * refused to bolt a resumed session onto a fresh build. Everything around the turn still runs:
   * the gates, the backlog loop, live chat — the flow resumes, not just the conversation.
   */
  resumeSessionId?: string
  /**
   * Live chat (#714): once the opening exchange settles, take the user's own messages, each
   * continuing the same session. The session then ends itself when the queue is idle (#1390)
   * unless {@link stayOpenChat} parks it. Unset for a headless session, which ends when the agent
   * stops asking.
   */
  messages?: AgentMessages
  /**
   * Keep the chat parked for the next message instead of ending on an idle queue (#1390).
   * Only for a session whose own surface is the single one — it has no dashboard to resume
   * through, so ending would leave its composer a dead end.
   */
  stayOpenChat?: boolean
  /** Observe the unified event stream. */
  onEvent?: (event: FrameworkEvent) => void
}

/** What a session returns. */
export interface RunAgentResult {
  /** The final turn's text. */
  text: string
  /** Every event emitted, in order. */
  events: FrameworkEvent[]
  /** How the backlog loop (#323) ended, when it ran. */
  todo?: TodoLoopResult
}

/**
 * Run one session to completion: send the opening prompt, honor each await gate (#337/#339) by
 * re-prompting with the user's answer, work the backlog if this is a build, and stay open for the
 * user's own messages when a chat source is wired.
 *
 * Emits the same {@link FrameworkEvent} stream throughout — `session`, `system-prompt`, `driver`,
 * `choice`, `usage`, `intent`, `end` — so the dashboard, the store, and the control channel (#344)
 * read one shape regardless of what opened the session.
 */
export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const events: FrameworkEvent[] = []
  const emit = (event: FrameworkEvent): void => {
    events.push(event)
    // Swallow a listener that throws: emit runs both inside and outside the try below (the
    // session-start and system-prompt events fire first), so an unguarded throw would escape
    // the session uncaught or skip its `end` event.
    if (opts.onEvent) {
      try {
        opts.onEvent(event)
      } catch (err) {
        console.error('[framework] onEvent threw; ignoring:', err)
      }
    }
  }

  const kind = opts.kind ?? 'build'
  // A hand-off location (#1225): the prompt leaves this machine and the reply never comes back, so
  // the opening turn is the entire session and every phase after it is dropped rather than fed.
  const handsOff = isHandsOff(opts.location)
  // The built-in #326 system prompt + any user SYSTEM.md frame the session (#301).
  const tf: TfContext = { prompt: opts.prompt }
  const system = composeAgentSystem({
    vanilla: opts.vanilla,
    browser: opts.browser,
    handsOff,
    ownedCheckout: opts.ownedCheckout,
    transparent: opts.transparent,
    user: opts.systemPrompt,
    tf,
    context: opts.context,
  })

  emitSessionStart({ emit, driver: opts.driver, cwd: opts.cwd, sessionLink: opts.sessionLink, model: opts.model })
  // What this session was asked for, so the store and the dashboard have its title without
  // parsing a prompt (#211). Nothing is read off disk and appended after the system prompt, so
  // the text emitted below is the whole of it (#547); the per-turn user prompts ride along as
  // `driver` `start` events, so every prompt sent is visible.
  emit({ kind: 'intent', text: opts.prompt })
  if (system) emit({ kind: 'system-prompt', text: system })

  // Usage accounting plus the one self-stop left (#358): the session signal composes the caller's
  // abort with the one an answer trips. Nothing stops a session for spending (E1) — that is
  // decided before it starts.
  const { agentSignal, onDriverEvent, answerController } = createAgentControls({
    emit,
    signal: opts.signal,
    sessionLink: opts.sessionLink,
  })

  // One driver session for the whole agent; each prompt is a fresh invocation. A continuation
  // (#720/#1467) resumes the stopped leg's conversation instead of starting anew.
  const resuming = typeof opts.resumeSessionId === 'string' && opts.resumeSessionId.length > 0
  const session: DriverSession = await opts.driver.start({
    cwd: opts.cwd,
    system,
    ...(opts.model ? { model: opts.model } : {}),
    ...(resuming ? { resumeSessionId: opts.resumeSessionId } : {}),
    signal: agentSignal,
    onEvent: onDriverEvent,
  })

  // Non-blocking signals the agent emits per turn: markdown views (#441) and the session-lifecycle (#326)
  // signals (session name, ready-for-merge). None stop the turn.
  const emitTurnSignals = createTurnSignalEmitter(emit)

  try {
    const rounds = await runAwaitRounds({
      session,
      prompt: openingPrompt(opts, resuming),
      emitTurnSignals,
      requestChoice: opts.requestChoice,
      emit,
      signal: agentSignal,
      ...(resuming ? { resume: true } : {}),
      // Chat comes after the backlog for a build, so it is wired below rather than here.
      ...(opts.messages && (kind === 'prompt' || handsOff) ? { messages: opts.messages } : {}),
      ...(opts.stayOpenChat ? { stayOpenChat: true } : {}),
    })
    // The agent kept asking past the limit: finish with the latest turn rather than loop.
    if (rounds.exhausted) emit({ kind: 'log', message: 'Finishing the session (await limit reached).' })
    // An answer marked `stop` (#358) ends the session rather than carrying on: the user takes over
    // with fresh instructions, so building on a plan they just declined is the one thing not to
    // do. Tripped through the agent signal so every path ends the same way a Stop does — the prompt
    // path used to finish cleanly here instead, which meant the same decline read as a completed
    // session on one path and a stop on the other.
    if (rounds.stopped) answerController.abort(new Error('[framework] stopped by your answer'))
    let text = rounds.text

    // The session controls (a Stop, an answer that said stop #358) abort between turns, and the
    // opening rounds do not observe the abort themselves, so look before treating this as a
    // success — otherwise an aborted session settles as done.
    if (agentSignal.aborted) {
      throw agentSignal.reason instanceof Error ? agentSignal.reason : new Error('[framework] run stopped')
    }

    // The backlog loop (#323): with the opening work settled, consume the agent's own TODO
    // backlog one gated entry per turn until it is empty. The session signal (Stop / budget cap
    // #322) and the item cap bound it for unattended sessions.
    let todo: TodoLoopResult | undefined
    if (kind === 'build' && !handsOff && (opts.todoLoop ?? opts.driver.id !== 'fake')) {
      todo = await runTodoLoop({
        session,
        cwd: opts.cwd,
        emit,
        requestChoice: opts.requestChoice,
        signal: agentSignal,
      })
      // A plan declined mid-backlog with a stop-marked answer ends the session, the same as #217.
      if (todo.sessionStopped) answerController.abort(new Error('[framework] stopped by your answer'))
    }

    // Live chat (#714) for a build, once its backlog is worked: a prompt session already took it
    // inside the rounds above, where there is nothing to come between.
    if (opts.messages && kind === 'build' && !handsOff && !agentSignal.aborted) {
      const chat = await runChatAfterBacklog(session, opts, emit, emitTurnSignals, agentSignal)
      text = chat.text
      // Same as #217, for the chat leg: a stop here ends the session rather than publishing.
      if (chat.stopped) answerController.abort(new Error('[framework] stopped by your answer'))
    }

    // The backlog and chat legs abort the same signal a Stop does, but neither observes it itself
    // (as the opening rounds do not, #233). Look before settling as a success, or a stopped session
    // reaches `end ok:true` below and publishes the very work its answer declined.
    if (agentSignal.aborted) {
      throw agentSignal.reason instanceof Error ? agentSignal.reason : new Error('[framework] run stopped')
    }

    // Say why a hand-off stops here, so a finished one does not read as a session that gave up a
    // turn in. The link itself is already on the driver's `cloud <url>` action.
    if (handsOff) {
      emit({ kind: 'log', message: 'Handed off: the rest of this session happens in its own session, which opens its own pull request.' })
    }
    emit({ kind: 'end', ok: true })
    return { text, events, ...(todo ? { todo } : {}) }
  } catch (err) {
    const { stopped, detail } = endStopDetail({ err, ...(opts.signal ? { signal: opts.signal } : {}), answerController })
    emit({ kind: 'end', ok: false, ...(stopped ? { stopped: true } : {}), detail })
    throw err
  } finally {
    await session.dispose()
  }
}

/**
 * The first thing the agent is sent: the user's text rendered through the system prompt's own
 * `# User prompt` slot — the one place the user prompt is framed, for a build and a prompt
 * session alike (#1683 review: the build wrapper that used to sit beside it said nothing the
 * system prompt did not).
 *
 * A resumed session (#720/#1467) gets the text verbatim: the `--resume`d transcript already
 * carries the framing, so composing it again would stack a second preamble onto a conversation
 * that lived through the first. So does a transparent or vanilla session — no built-in prompt
 * means no slot to render into.
 */
function openingPrompt(opts: RunAgentOptions, resuming: boolean): string {
  if (resuming || opts.transparent || opts.vanilla) return opts.prompt
  return renderSystemPrompt({ prompt: opts.prompt }).user
}

/** The live-chat phase a build reaches after its backlog, sharing the rounds' own loop. */
async function runChatAfterBacklog(
  session: DriverSession,
  opts: RunAgentOptions,
  emit: (event: FrameworkEvent) => void,
  emitTurnSignals: (text: string) => void,
  signal: AbortSignal,
): Promise<{ text: string; stopped: boolean }> {
  const { runChatPhase } = await import('./await-gate.js')
  const chat = await runChatPhase(
    session,
    opts.messages!,
    { text: '' },
    {
      ...(opts.requestChoice ? { requestChoice: opts.requestChoice } : {}),
      emit,
      emitTurnSignals,
      signal,
    },
    opts.stayOpenChat === true,
  )
  // `stopped` carries through, not just the text: an answer marked `stop` here must end the session
  // the same way it does in the opening rounds, or a stopped chat settles as a clean, published run.
  return { text: chat.turn.text, stopped: chat.stopped }
}
