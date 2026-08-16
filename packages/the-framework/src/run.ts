import type { Driver, DriverSession } from './driver/index.js'
import { composeRunSystem, renderSystemPrompt, type TfContext } from './system-prompt.js'
import { createRunControls, emitSessionStart, endStopDetail } from './run-telemetry.js'
import { createTurnSignalEmitter } from './turn-gate.js'
import { runAwaitRounds } from './await-gate.js'
import { runTodoLoop, type TodoLoopResult } from './todo-loop.js'
import { buildPrompt, extendPrompt, isWorkspaceEmpty, scaffoldPrompt } from './steps.js'
import { type ChoicePick, type ChoiceRequest, type FrameworkEvent } from './events.js'
import type { RunMessages } from './run-messages.js'
import { isHandsOff, type RunLocation } from './run-location.js'

/**
 * One session: frame the wrapped agent, send it a prompt, honor the gates it answers with, and
 * stream every step as a {@link FrameworkEvent}. Reversible — swap in a different `Driver`
 * without touching this wiring.
 *
 * There used to be two of these. `runFramework` drove a build through ai-autopilot's `Bootstrap`
 * spine, and `runPrompt` ran one prompt verbatim; `composeRunSystem` exists specifically because
 * the two each inlined the system composition and drifted apart (#500/#501). Once the review loop
 * (A5) and the `Bootstrap` spine (A3) went, the build path *was* "one prompt, honoring gates" —
 * which is what the prompt path already was. What is left of the difference is two options rather
 * than two implementations: which prompt opens the session, and whether the agent's own backlog is
 * worked afterwards.
 */

/** What a session is: an intent to build from, or a prompt to run verbatim. */
export type SessionKind = 'build' | 'prompt'

/** Options for {@link runSession}. */
export interface RunSessionOptions {
  /**
   * What the session is asked to do. For `build`, the intent the opening prompt is composed
   * around; for `prompt`, the text sent as-is (modulo the system template's user slot).
   */
  prompt: string
  /** Which opening prompt this session gets, and whether the backlog loop follows. Default `build`. */
  kind?: SessionKind
  /**
   * Where this session's turns execute (#1050/#610). Default `local`. Only `web` hands the work
   * somewhere this machine cannot follow, which makes the opening prompt the whole session —
   * see {@link isHandsOff}.
   */
  location?: RunLocation
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
  /** Per-session cap on backlog entries worked (#323). Default 25. */
  todoMaxItems?: number
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
  messages?: RunMessages
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
export interface RunSessionResult {
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
export async function runSession(opts: RunSessionOptions): Promise<RunSessionResult> {
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
  const system = composeRunSystem({
    vanilla: opts.vanilla,
    browser: opts.browser,
    handsOff,
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

  // Usage accounting, and the run's signal. Nothing stops a session but the caller: not spending
  // (E1, decided before it starts) and not a declined plan (D6, an answer the agent is given).
  const { runSignal, onDriverEvent } = createRunControls({
    emit,
    signal: opts.signal,
    sessionLink: opts.sessionLink,
  })

  // One driver session for the whole run; each prompt is a fresh invocation. A continuation
  // (#720/#1467) resumes the stopped leg's conversation instead of starting anew.
  const resuming = typeof opts.resumeSessionId === 'string' && opts.resumeSessionId.length > 0
  const session: DriverSession = await opts.driver.start({
    cwd: opts.cwd,
    system,
    ...(opts.model ? { model: opts.model } : {}),
    ...(resuming ? { resumeSessionId: opts.resumeSessionId } : {}),
    signal: runSignal,
    onEvent: onDriverEvent,
  })

  // Non-blocking signals the agent emits per turn: markdown views (#441) and the #326 lifecycle
  // signals (session name, ready-for-merge). None stop the turn.
  const emitTurnSignals = createTurnSignalEmitter(emit)

  try {
    const rounds = await runAwaitRounds({
      session,
      prompt: openingPrompt(opts, kind, resuming, session.cwd),
      emitTurnSignals,
      requestChoice: opts.requestChoice,
      emit,
      signal: runSignal,
      ...(resuming ? { resume: true } : {}),
      // Chat comes after the backlog for a build, so it is wired below rather than here.
      ...(opts.messages && (kind === 'prompt' || handsOff) ? { messages: opts.messages } : {}),
      ...(opts.stayOpenChat ? { stayOpenChat: true } : {}),
    })
    // The agent kept asking past the limit: finish with the latest turn rather than loop.
    if (rounds.exhausted) emit({ kind: 'log', message: 'Finishing the session (await limit reached).' })
    let text = rounds.text

    // #182: a build must actually produce an app. If nothing landed on disk the agent stalled
    // (e.g. sanity-checking the stack), so re-prompt once with a hard "create it from scratch"
    // directive. Only for a real driver — the fake one writes nothing, so its workspace always
    // reads empty — and only when the agent is not mid-question, which the gates just drained.
    if (kind === 'build' && !resuming && opts.driver.name !== 'fake' && isWorkspaceEmpty(opts.cwd)) {
      const scaffolded = await session.prompt(scaffoldPrompt(opts.prompt), { signal: runSignal })
      emitTurnSignals(scaffolded.text)
      text = scaffolded.text
    }

    // A Stop aborts between turns, and the opening rounds do not observe the abort themselves,
    // so look before treating this as a success — otherwise an aborted session settles as done.
    if (runSignal.aborted) {
      throw runSignal.reason instanceof Error ? runSignal.reason : new Error('[framework] run stopped')
    }

    // The backlog loop (#323): with the opening work settled, consume the agent's own TODO
    // backlog one gated entry per turn until it is empty. The session signal (Stop / budget cap
    // #322) and the item cap bound it for unattended sessions.
    let todo: TodoLoopResult | undefined
    if (kind === 'build' && !handsOff && (opts.todoLoop ?? opts.driver.name !== 'fake')) {
      todo = await runTodoLoop({
        session,
        cwd: opts.cwd,
        emit,
        requestChoice: opts.requestChoice,
        signal: runSignal,
        maxItems: opts.todoMaxItems,
      })
    }

    // Live chat (#714) for a build, once its backlog is worked: a prompt session already took it
    // inside the rounds above, where there is nothing to come between.
    if (opts.messages && kind === 'build' && !handsOff) {
      const chat = await runChatAfterBacklog(session, opts, emit, emitTurnSignals, runSignal)
      text = chat
    }

    // Say why a hand-off stops here, so a finished one does not read as a session that gave up a
    // turn in. The link itself is already on the driver's `cloud <url>` action.
    if (handsOff) {
      emit({ kind: 'log', message: 'Handed off: the rest of this session happens in its own session, which opens its own pull request.' })
    }
    emit({ kind: 'end', ok: true })
    return { text, events, ...(todo ? { todo } : {}) }
  } catch (err) {
    const { stopped, detail } = endStopDetail({ err, ...(opts.signal ? { signal: opts.signal } : {}) })
    emit({ kind: 'end', ok: false, ...(stopped ? { stopped: true } : {}), detail })
    throw err
  } finally {
    await session.dispose()
  }
}

/**
 * The first thing the agent is sent.
 *
 * A resumed session (#720/#1467) gets the text verbatim: the `--resume`d transcript already
 * carries the framing, so composing it again would stack a second preamble onto a conversation
 * that lived through the first. So does a transparent or prompt-less session, which is what
 * "raw `claude -p`" means. A build is framed for the workspace it lands in: an existing codebase
 * is *extended*, not rebuilt from scratch (#185).
 */
function openingPrompt(opts: RunSessionOptions, kind: SessionKind, resuming: boolean, cwd: string): string {
  if (resuming || opts.transparent) return opts.prompt
  if (kind === 'prompt') {
    return opts.vanilla ? opts.prompt : renderSystemPrompt({ prompt: opts.prompt }).user
  }
  // Gated on a real driver, so the fake one (which writes nothing, so its workspace always reads
  // empty) always takes the greenfield path and stays deterministic.
  return opts.driver.name !== 'fake' && !isWorkspaceEmpty(cwd) ? extendPrompt(opts.prompt) : buildPrompt(opts.prompt)
}

/** The live-chat phase a build reaches after its backlog, sharing the rounds' own loop. */
async function runChatAfterBacklog(
  session: DriverSession,
  opts: RunSessionOptions,
  emit: (event: FrameworkEvent) => void,
  emitTurnSignals: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
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
  return chat.turn.text
}
