import type {
  BootstrapEvent,
  BootstrapResult,
  BootstrapScope,
  BuildContext,
  SupervisorEvent,
  SupervisorRun,
} from './run-types.js'
import type { Driver, DriverSession } from './driver/index.js'
import { composeRunSystem, type EcoOptions, type TfContext } from './system-prompt.js'
import { createRunControls, emitSessionStart, endStopDetail } from './run-telemetry.js'
import { AWAIT_PROTOCOL, createTurnSignalEmitter } from './turn-gate.js'
import { drainGates, runChatPhase, type BindProjectDeps, type RecordMessage } from './await-gate.js'
import { leaveResumeNote, runTodoLoop, type TodoLoopResult } from './todo-loop.js'
import { continueAfterChoice, driverBuild } from './steps.js'
import { OPEN_LOOP_MODES, type ChoicePick, type ChoiceRequest, type FrameworkEvent } from './events.js'
import type { RunMessages } from './run-messages.js'
import { errorMessage } from './error-message.js'

/**
 * The framework's default full-fledged pass budget. Higher than ai-autopilot's
 * base of 3 because a from-scratch build spends its first pass or two just
 * bootstrapping an empty workspace before there is anything to polish (#182).
 */
/** Options for {@link runFramework}. */
export interface RunFrameworkOptions {
  /** What the user wants built (the one scope question's answer). */
  intent: string
  /** How much app: a quick prototype (no full-fledged loop) or the full thing. Default `"full"`. */
  scope?: BootstrapScope
  /** The wrapped coding agent. */
  driver: Driver
  /** Absolute workspace path the agent builds in. */
  cwd: string
  /** Model id to pass through to the driver. */
  model?: string
  /**
   * A user-authored system prompt (from `SYSTEM.md`) injected into every prompt
   * (#301). Load with `loadUserSystemPrompt(cwd)`. Composed after the built-in
   * #326 system prompt, so a repo can add its own instructions on top of the default.
   */
  systemPrompt?: string
  /**
   * Inject the built-in #326 system prompt into every prompt (#301). Default
   * `true`; pass `false` (e.g. from `the-framework.yml`) to remove it. The name
   * is the historical config key: #326 is the anti-lazy-pill's (#297) successor.
   */
  antiLazyPill?: boolean
  /** This run has a real browser (#824), so the system channel says so. */
  browser?: boolean
  /**
   * This is a project-less "topic" run (#1120): advertise the bind gate (#1121) in the system
   * channel and wire {@link bind} so an `await-bind-project` / `await-create-project` gate resolves.
   */
  topic?: boolean
  /** The bind seams (#1121) a topic run's gate resolves against. Only meaningful with {@link topic}. */
  bind?: BindProjectDeps
  /** Transparent mode (#625): empty the system channel entirely (raw `claude -p`); overrides antiLazyPill/eco. */
  transparent?: boolean
  /** Eco fine-grained control (#314): drop the enabled #326 sections to save tokens. */
  eco?: EcoOptions
  /** In-context directories (#439): added as one `Context:` line to the system prompt. */
  context?: readonly string[]
  /**
   * A link to the live agent session, shown on the dashboard. Either a literal
   * URL, or a template with `{sessionId}` (see {@link SESSION_ID_PLACEHOLDER})
   * that resolves once the wrapped agent reports its real id via `session-update`.
   */
  sessionLink?: string
  /** Interrupt the run between phases. */
  signal?: AbortSignal
  /**
   * Pause the run on an interactive choice and await a pick (#304). Called when a
   * build turn stops to ask (#337/#358): the run emits a `choice` event, calls
   * this, and resumes on the returned option. Omit for a headless run: the gate
   * then auto-accepts the recommended option without pausing. The CLI wires this
   * to the dashboard's Accept button + autopilot countdown.
   */
  requestChoice?: (req: ChoiceRequest) => Promise<ChoicePick>
  /**
   * Stop the run once cumulative agent cost reaches this many USD (budget cap,
   * #322). Checked after each turn that reports usage: the turn that crosses the
   * cap finishes, then the run stops itself (a clean stop, not a failure). Omit
   * for no cap. This gates on what *this run* spent, which is a separate question
   * from where the account's quota stands (readable via #517 / #521, and gated on
   * by #519's consumption limits).
   */
  budgetUsd?: number
  /**
   * Consult the consumption limits between turns (#529): return the limit that
   * has been reached to pause the run, or `null` to carry on.
   *
   * Must answer from a cached reading — a live quota read spawns the whole agent
   * CLI (~5s). Compose one from a `QuotaPoller` and `consumptionStatus`. Omit to
   * leave the run ungated, which is also what a gate that throws resolves to:
   * an unreadable quota must never stop the user's work (Rom's call on #519).
   */
  consumptionGate?: () => string | null
  /**
   * Run the backlog loop (#323) after the build settles: consume the agent's own
   * `TODO_AGENTS.md` one entry per turn until empty, gating
   * before each entry when {@link requestChoice} is wired. Default: on for real
   * drivers, off for the fake one (its scripted demo writes no backlog and must
   * stay deterministic). Set explicitly to force either way.
   */
  todoLoop?: boolean
  /** Per-run cap on backlog entries worked (#323). Default 25. */
  todoMaxItems?: number
  /**
   * Continue a stopped build run's conversation (#1467): the captured agent session id to
   * `--resume`. When set, the build turn sends {@link RunFrameworkOptions.intent} verbatim as a
   * continuation message instead of rendering the build/extend prompt — the resumed transcript
   * already carries the scope→build framing, which is exactly why #782 refused to bolt
   * `--resume-session` onto a fresh build run. Everything around the turn still runs: the
   * bootstrap narration with its synthesize framing, the review checklist where configured, the
   * backlog loop and live chat — the flow resumes, not just the conversation.
   */
  resumeSessionId?: string
  /**
   * Live chat (#714): once the build settles, take the user's own messages, each
   * resuming the build session for full context. The session then ends itself when
   * the queue is idle (#1390) unless {@link stayOpenChat} parks it. Wired only for
   * an interactive run — a headless run leaves it unset and ends when the build is
   * done, exactly as before.
   */
  messages?: RunMessages
  /**
   * Keep the chat parked for the next message instead of ending on an idle queue (#1390).
   * Only for a run whose own terminal dashboard is the single surface — it has no daemon
   * to resume the session through, so ending would leave its composer a dead end.
   */
  stayOpenChat?: boolean
  /** Record each chat turn to the committed conversation (#908). Best-effort; unset = not recorded. */
  recordMessage?: RecordMessage
  /** Observe the unified event stream. */
  onEvent?: (event: FrameworkEvent) => void
}

/** What a run returns. */
export interface RunFrameworkResult {
  result: BootstrapResult
  events: FrameworkEvent[]
  /** How the backlog loop (#323) ended, when it ran. */
  todo?: TodoLoopResult
}

/**
 * Run the whole turnkey flow: frame the wrapped agent, then drive scope → build entirely
 * *through* the driver (option A). Every phase, plus the agent's own progress, streams as
 * a {@link FrameworkEvent}. Reversible: swap in a
 * different `Driver`, without touching this wiring.
 */
export async function runFramework(opts: RunFrameworkOptions): Promise<RunFrameworkResult> {
  const events: FrameworkEvent[] = []
  const emit = (event: FrameworkEvent) => {
    events.push(event)
    if (opts.onEvent) {
      try {
        opts.onEvent(event)
      } catch (err) {
        console.error('[framework] onEvent threw; ignoring:', err)
      }
    }
  }

  // The built-in #326 system prompt + any user SYSTEM.md are the whole prompt. Only
  // the template's system half is used here: each Bootstrap step composes its own
  // prompt around the intent, so the user-prompt slot stays with the steps.
  // `tf.params.autopilot` reflects the run's autopilot mode (#325).
  const tf: TfContext = {
    prompt: opts.intent,
    params: { ...(opts.eco ? { eco: opts.eco } : {}) },
  }
  // The "read" half of the bind mechanism (#1121/#1129): a topic run's channel lists the projects
  // it can bind to. Read through the same injected seam the gate resolves against, so no `node:fs`
  // reaches this path; absent for a non-topic run, which gets no bind block at all.
  const topicProjects = opts.topic && opts.bind ? (await opts.bind.listProjects()).map(p => p.path) : undefined
  // One assembly path for the whole system channel (#501), shared with the
  // direct-prompt path so the two can never drift (the drift behind #500).
  const system = composeRunSystem({
    antiLazyPill: opts.antiLazyPill,
    browser: opts.browser,
    handsOff: opts.driver.handsOff === true,
    topic: opts.topic,
    ...(topicProjects ? { topicProjects } : {}),
    transparent: opts.transparent,
    user: opts.systemPrompt,
    tf,
    context: opts.context,
  })

  emitSessionStart({ emit, driver: opts.driver, cwd: opts.cwd, sessionLink: opts.sessionLink, model: opts.model })
  // Surface the exact system prompt the agent runs under (#343). Nothing is read
  // off disk and appended after this, so the text is the whole of it (#547). The
  // per-turn user prompts ride along as `driver` `start` events, so the dashboard
  // can show every prompt sent.
  if (system) emit({ kind: 'system-prompt', text: system })
  // The run's abort plumbing and driver-event sink: the caller's signal composed with
  // the budget (#322), consumption (#529), and plan-decline (#358) self-stops.
  const { runSignal, onDriverEvent, consumptionTrip, budgetController, consumptionController, declineController } =
    createRunControls({
      emit,
      signal: opts.signal,
      sessionLink: opts.sessionLink,
      budgetUsd: opts.budgetUsd,
      consumptionGate: opts.consumptionGate,
    })

  // 2. One driver session for the whole run; each prompt is a fresh invocation.
  // A continuation (#1467) resumes the stopped leg's conversation instead of starting anew.
  const resuming = typeof opts.resumeSessionId === 'string' && opts.resumeSessionId.length > 0
  const session: DriverSession = await opts.driver.start({
    cwd: opts.cwd,
    system,
    ...(opts.model ? { model: opts.model } : {}),
    ...(resuming ? { resumeSessionId: opts.resumeSessionId } : {}),
    signal: runSignal,
    onEvent: onDriverEvent,
  })


  // A real driver writes files to the workspace, so the build/improve steps can
  // detect an empty workspace and hard-scaffold it (#182). The fake driver writes
  // nothing (its whole workspace is always "empty"), so it opts out to stay
  // deterministic.
  const verifyWorkspace = opts.driver.name !== 'fake'
  const workspaceOpt = verifyWorkspace ? { verifyWorkspace: true } : {}

  // The shared deps of every agent-facing gate.
  const gateDeps = {
    ...(opts.requestChoice ? { requestChoice: opts.requestChoice } : {}),
    emit,
    signal: runSignal,
    onDecline: () => declineController.abort(new Error('[framework] plan declined')),
    // Topic runs only (#1121): resolves an await-bind-project / await-create-project gate.
    ...(opts.bind ? { bind: opts.bind } : {}),
  }
  // A hand-off driver (#1225): the prompt leaves this machine and the reply never comes back,
  // so the build prompt is the entire run. Every phase after it — the backlog gate and
  // live chat — would be reading
  // the driver's own "handed off to <url>" summary as if the agent had written it. That is
  // what put a verdict-is-missing complaint and an unanswerable "Start the next
  // backlog item?" call on a dashboard whose agent was somewhere else entirely. So the phases
  // are dropped rather than fed: the run is scope -> build and nothing after it.
  const handsOff = opts.driver.handsOff === true
  try {
    // A3: the Bootstrap spine degenerated to two steps once the review loop went (A5) — scope is
    // a constant function and build is one driver turn — so the phases are called directly. The
    // `bootstrap` events are still emitted, because the dashboard, the store and the terminal all
    // read the run's intent, scope and completion from them.
    const scope = opts.scope ?? 'full'
    emit({ kind: 'bootstrap', event: { type: 'scope', scope, intent: opts.intent } })
    // Resuming (#1467): the intent IS the continuation message and goes out verbatim — the
    // resumed transcript already carries the build framing, so re-rendering it would stack
    // a second scope→build preamble onto a conversation that lived through the first.
    const build = agentAwaitGate(
      driverBuild(session, { ...workspaceOpt, ...(resuming ? { prompt: (intent: string) => intent } : {}) }),
      session,
      gateDeps,
    )
    const supervised = await build({
      scope,
      intent: opts.intent,
      onEvent: (event: SupervisorEvent) => emit({ kind: 'bootstrap', event: { type: 'build', event } }),
      signal: runSignal,
    })
    const result: BootstrapResult = { scope, intent: opts.intent, run: supervised }
    emit({ kind: 'bootstrap', event: { type: 'done', result } })
    // The run controls (budget #322, decline #358, quota #529) abort between phases. The review
    // loop used to observe the abort for free; with it gone the run must look for itself before
    // treating the build as a success.
    if (runSignal.aborted) {
      throw runSignal.reason instanceof Error ? runSignal.reason : new Error('[framework] run stopped')
    }
    // The backlog loop (#323): with the build settled, consume the agent's own
    // TODO backlog one gated entry per turn until it is empty. Default on for
    // real drivers (the fake demo writes no backlog and must stay deterministic;
    // its reused tmp workspace could also carry stale files). The run signal
    // (Stop / budget cap #322) and the item cap bound it for unattended runs.
    let todo: TodoLoopResult | undefined
    if (!handsOff && (opts.todoLoop ?? opts.driver.name !== 'fake')) {
      todo = await runTodoLoop({
        session,
        cwd: opts.cwd,
        emit,
        requestChoice: opts.requestChoice,
        signal: runSignal,
        maxItems: opts.todoMaxItems,
      })
    }
    // Live chat (#714): with the build settled, take the user's own messages, each continuing
    // the same session — draining what queued and ending on idle (#1390), or parked until Stop
    // for a terminal-dashboard run (stayOpenChat).
    // A hand-off run has no session here to continue: the CLI can start a cloud session and
    // pull one back, but it cannot send a second message to one, so staying open would offer
    // a composer whose every message answers itself. The run ends instead, with the link.
    if (opts.messages && !handsOff) {
      await runChatPhase(session, opts.messages, { text: '' }, {
        ...(opts.requestChoice ? { requestChoice: opts.requestChoice } : {}),
        emit,
        emitTurnSignals: createTurnSignalEmitter(emit),
        signal: runSignal,
        ...(opts.recordMessage ? { recordMessage: opts.recordMessage } : {}),
      }, opts.stayOpenChat === true)
    }
    // Say why the run stops here, so a finished hand-off does not read as a run that gave up
    // one phase in. The link itself is already on the driver's `cloud <url>` action.
    if (handsOff) emit({ kind: 'log', message: 'Handed off: the rest of this run happens in its own session, which opens its own pull request.' })
    emit({ kind: 'end', ok: true })
    return { result, events, ...(todo ? { todo } : {}) }
  } catch (err) {
    const { stopped, detail } = await endStopDetail({
      err,
      ...(opts.signal ? { signal: opts.signal } : {}),
      budgetController,
      consumptionController,
      declineController,
      consumptionTrip,
      ...(opts.budgetUsd != null ? { budgetUsd: opts.budgetUsd } : {}),
      leaveResumeNote: () => leaveResumeNote(opts.cwd, events, emit),
    })
    emit({ kind: 'end', ok: false, ...(stopped ? { stopped: true } : {}), detail })
    throw err
  } finally {
    await session.dispose()
  }
}

/**
 * The agent-authored await gate (#337 / #339): the turn-boundary counterpart to the
 * framework-emitted plan-approval gate (#304). When a build turn ends by asking the
 * user — an `await-choices` (pick one), `await-multiselect` (pick any), or
 * `await-confirmation` (approve/decline a plan, #358) block per
 * {@link AWAIT_PROTOCOL}, e.g. the #326 alternatives flow or the [Research] preset (#331)
 * — rather than finishing, show it, wait for the answer, and re-prompt the driver to
 * continue from that decision. A no-op unless a {@link RunFrameworkOptions.requestChoice}
 * handler is wired (headless byte-identical), and unless the agent actually stopped to
 * ask (the common case returns straight through). Bounded so an agent that keeps asking
 * can't loop forever.
 */
function agentAwaitGate(
  base: (ctx: BuildContext) => Promise<SupervisorRun>,
  session: DriverSession,
  deps: {
    requestChoice?: (req: ChoiceRequest) => Promise<ChoicePick>
    emit: (event: FrameworkEvent) => void
    /** The run signal; a gate parked for an answer unblocks (default) if the run aborts. */
    signal?: AbortSignal
    /** Called when a confirmation gate is declined (#358): the run stops instead of building on. */
    onDecline?: () => void
    /** The bind seams for a topic run (#1121); absent for every other run. */
    bind?: BindProjectDeps
  },
): (ctx: BuildContext) => Promise<SupervisorRun> {
  return async ctx => {
    const { requestChoice, emit } = deps
    // Non-blocking signals the agent emitted this turn: markdown views (#441) pushed to the
    // rail, and the #326 lifecycle signals (session name, ready-for-merge) that flip the run's
    // dashboard status. None stop the turn.
    const emitTurnSignals = createTurnSignalEmitter(emit)
    let run = await base(ctx)
    emitTurnSignals(run.text)
    // The run controls (budget #322, quota #529) abort on the build turn's own usage.
    // The build is the bootstrap's last step (#1372: nothing reviews it), so a stop the loop
    // would once have caught must throw here — otherwise
    // the bootstrap settles an aborted run as done.
    const throwIfStopped = () => {
      if (!deps.signal?.aborted) return
      throw deps.signal.reason instanceof Error ? deps.signal.reason : new Error('[framework] run stopped')
    }
    // Headless: nobody to ask, so the build's turn stands as it is rather than auto-answering
    // its own question. (The prompt paths differ here — they resolve to the recommended pick.)
    if (!requestChoice) {
      throwIfStopped()
      return run
    }

    const drained = await drainGates(run, { ...deps, emitTurnSignals }, (question, answer) =>
      continueAfterChoice(session, ctx, question, answer),
    )
    // A declined plan (#358) ends the build here rather than re-prompting: the user takes over
    // with fresh instructions (e.g. a new run from the dashboard).
    if (drained.declined) deps.onDecline?.()
    // The agent kept asking past the limit: proceed with the latest turn rather than loop.
    else if (drained.exhausted) emit({ kind: 'log', message: 'Proceeding with the build (await limit reached).' })
    throwIfStopped()
    return drained.turn
  }
}
