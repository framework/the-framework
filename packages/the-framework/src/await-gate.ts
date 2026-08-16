import { MAX_AWAIT_ROUNDS, continuationPrompt, parseAwaitGate, stopMessage, type ParsedAwaitGate } from './turn-gate.js'
import { pickedIds, type ChoicePick, type ChoiceRequest, type FrameworkEvent } from './events.js'
import type { DriverSession, DriverTurn } from './driver/index.js'
import type { ChatMessage, AgentMessages } from './agent-messages.js'

// The shared await/choice/chat machinery (#304/#337/#339/#714), lifted out of the run
// lifecycle so the build path (run.ts), the direct prompt path (prompt-run.ts), and the
// backlog loop (todo-loop.ts) can all reach it without importing the orchestrator — which is
// what removed the run <-> todo-loop cycle. run.ts composes these primitives into a lifecycle;
// it does not own them.

/** What a resolved gate yields. */
export interface GateAnswer {
  /** The label(s) picked, as the continuation prompt words it to the agent. */
  answer: string
  /** The user picked an option the agent marked `stop` (#358): hand back rather than continue. */
  stop: boolean
}

/**
 * Resolve one parsed await gate (#337) to the user's answer text, ready to seed the continuation
 * prompt: emits the `choice`, parks for the pick (or the headless/abort fallback), and maps the
 * picked id(s) back to label(s). Round 0 keeps a stable gate id; later rounds get a unique one so
 * a dashboard never confuses a re-ask with the answer it just resolved. Shared by the build's
 * `agentAwaitGate`, the direct prompt path, and the backlog loop (#323).
 *
 * One path, where there were four. A gate that takes several picks answers with the labels it got
 * (or `(none)`); every other gate answers with the one label picked. What used to distinguish an
 * approval or a browser hand-off from an ordinary question was the options the agent wrote, and
 * that is all it is again.
 *
 * The answer also carries whether it *ends* the session, which is read off the option the user
 * picked rather than off the gate: on a multi-select one stopping pick among several is still a
 * stop, because an answer that says "stop" is not softened by the answers next to it.
 */
export async function resolveAwaitGate(
  gate: ParsedAwaitGate,
  round: number,
  deps: {
    requestChoice?: ((req: ChoiceRequest) => Promise<ChoicePick>) | undefined
    emit: (event: FrameworkEvent) => void
    signal?: AbortSignal | undefined
  },
): Promise<GateAnswer> {
  const signalOpt = deps.signal ? { signal: deps.signal } : {}
  const choiceOpt = deps.requestChoice ? { requestChoice: deps.requestChoice } : {}
  const id = round === 0 ? 'await-choices' : `await-choices-${round}`
  if (gate.multi) {
    const ids = await requestMultiSelect({ id, title: gate.title, options: gate.options, emit: deps.emit, ...choiceOpt, ...signalOpt })
    const picked = gate.options.filter(o => ids.includes(o.id))
    const labels = picked.map(o => o.label)
    return { answer: labels.length ? labels.join(', ') : '(none)', stop: picked.some(o => o.stop === true) }
  }
  const pickedId = await requestChoices({
    id,
    title: gate.title,
    options: gate.options,
    ...(gate.recommended ? { recommended: gate.recommended } : {}),
    ...(gate.file ? { file: gate.file } : {}),
    emit: deps.emit,
    ...choiceOpt,
    ...signalOpt,
  })
  const picked = gate.options.find(o => o.id === pickedId)
  return { answer: picked?.label ?? pickedId, stop: picked?.stop === true }
}

/** What {@link runAwaitRounds} hands back. */
export interface AwaitRoundsResult {
  /** The last turn's text. */
  text: string
  /** The agent was still asking when the round cap ran out. */
  exhausted: boolean
  /** The user answered a gate with a `stop` option (#358), so the session ends here. */
  stopped: boolean
}

/** Inputs to {@link runAwaitRounds}. */
export interface AwaitRoundsOptions {
  session: DriverSession
  /** The prompt that opens the exchange. */
  prompt: string
  /** Emit the signals each turn carries (#563). */
  emitTurnSignals: (text: string) => void
  requestChoice?: ((req: ChoiceRequest) => Promise<ChoicePick>) | undefined
  emit: (event: FrameworkEvent) => void
  signal?: AbortSignal | undefined
  /**
   * Live chat (#714): once the agent stops asking, take the user's own messages,
   * each resuming the same session. Unset for a headless run, which then
   * ends when the agent stops asking — byte-identical to before this existed.
   */
  messages?: AgentMessages | undefined
  /**
   * Keep the chat parked for the next message instead of ending on an idle queue (#1390).
   * Only for a run whose own terminal dashboard is the single surface — everything else
   * ends itself and is reopened via `--resume`. Default off.
   */
  stayOpenChat?: boolean | undefined
  /**
   * Resume a prior session on the OPENING prompt (#720): when the driver session was
   * seeded with a finished run's id, this makes the first message `--resume` that
   * conversation (full prior context) instead of starting fresh. Default off.
   */
  resume?: boolean | undefined
}

/** The shared deps of a turn that may hit an await gate or a chat message. */
export interface AwaitTurnDeps {
  requestChoice?: ((req: ChoiceRequest) => Promise<ChoicePick>) | undefined
  emit: (event: FrameworkEvent) => void
  emitTurnSignals: (text: string) => void
  signal?: AbortSignal | undefined
}

/**
 * Resolve the await gates (#337) a turn ended on: pick the answer, continue with it, repeat until
 * the agent stops asking, an answer says to stop (#358), or the {@link MAX_AWAIT_ROUNDS} cap trips.
 * Returns the settled turn plus which of those ended it.
 *
 * Every path that runs gates shares this loop: the opening prompt, each chat message, and
 * the build's `agentAwaitGate`. They differ only in how a turn is continued — a raw
 * `session.prompt`, or a pass that carries its own continuation — which is what
 * `continueWith` is. Keeping one loop is what stopped the per-turn signal emission from
 * having to be added to each copy by hand (#563).
 */
export async function drainGates<T extends { text: string }>(
  turn: T,
  deps: AwaitTurnDeps,
  continueWith: (question: string, answer: string) => Promise<T>,
): Promise<{ turn: T; exhausted: boolean; stopped: boolean }> {
  let gate = parseAwaitGate(turn.text)
  for (let round = 0; round < MAX_AWAIT_ROUNDS && gate; round++) {
    const { answer, stop } = await resolveAwaitGate(gate, round, deps)
    // A stopping answer is the one answer the agent is never given (#358): it is told nothing and
    // the turn it asked from is the last one. Not exhausted — the round cap had nothing to do
    // with it, and reporting both would make a deliberate stop read as a run that ran out.
    if (stop) {
      deps.emit({ kind: 'log', message: stopMessage(answer) })
      return { turn, exhausted: false, stopped: true }
    }
    deps.emit({ kind: 'log', message: `Continuing with your choice: ${answer}` })
    turn = await continueWith(gate.title, answer)
    deps.emitTurnSignals(turn.text)
    gate = parseAwaitGate(turn.text)
  }
  return { turn, exhausted: gate !== undefined, stopped: false }
}

/** Continue a plain driver session from a gate answer: the raw-prompt half of {@link drainGates}. */
function promptContinuation(session: DriverSession, deps: AwaitTurnDeps): (question: string, answer: string) => Promise<DriverTurn> {
  const signalOpt = deps.signal ? { signal: deps.signal } : {}
  return (question, answer) => session.prompt(continuationPrompt(question, answer), signalOpt)
}

/**
 * The live-chat loop (#714): deliver each of the user's messages by resuming the same
 * session (full conversational context), then honor any await gate it produced. Shared by
 * the direct prompt path and the build path, which both reach it once their work has settled.
 *
 * How it ends is the session-lifecycle rule of #1390. By default the loop only *drains*: a
 * message that already arrived is processed, and once the queue is idle the session ends
 * itself rather than parking on the user — merge fires at that natural end (armed + gated),
 * and a follow-up reopens the conversation via `--resume` (#762), like Claude Code web.
 * `stayOpen` keeps the old park-for-the-next-message lifecycle, for a run whose own terminal
 * dashboard is the only surface — it has no daemon to resume through, so ending would leave
 * its composer a dead end; that run still ends on Stop / budget cap (next -> undefined).
 *
 * Reports the settled `exhausted` of the *last* chat turn (#742): entering chat means the
 * opening prompt's await-round cap is no longer the run's end reason, and a phase that ends
 * on Stop / close is not exhausted at all.
 */
export async function runChatPhase(session: DriverSession, messages: AgentMessages, seed: DriverTurn, deps: AwaitTurnDeps, stayOpen = false): Promise<{ turn: DriverTurn; exhausted: boolean; stopped: boolean }> {
  const signalOpt = deps.signal ? { signal: deps.signal } : {}
  let turn = seed
  let exhausted = false
  for (;;) {
    let message: ChatMessage | undefined
    if (stayOpen) {
      // Parked on the user (#785): the work is settled and nothing is running until a message
      // arrives. Said out loud each time round, so a reader can tell waiting from working.
      deps.emit({ kind: 'settled' })
      message = await messages.next(deps.signal)
    } else {
      // Nothing needs a human (#1390): no park, no `settled` limbo — an idle queue is the
      // session's natural end, and the run's `end` event follows right behind it.
      message = deps.signal?.aborted ? undefined : messages.takeQueued()
    }
    if (message === undefined) return { turn, exhausted, stopped: false } // idle queue / Stop / budget cap: end the conversation.
    // The message shows in the feed as the driver's own `start` event (the YOU row), so it is not
    // echoed as a separate log line — that only duplicated it.
    turn = await session.prompt(message.text, { ...signalOpt, resume: true })
    deps.emitTurnSignals(turn.text)
    const drained = await drainGates(turn, deps, promptContinuation(session, deps))
    turn = drained.turn
    exhausted = drained.exhausted
    // A stopping answer ends the whole session, not just the message it came from (#358): the
    // user is taking over, so parking for their next chat message would be waiting on someone
    // who has already answered.
    if (drained.stopped) return { turn, exhausted, stopped: true }
  }
}

/**
 * Prompt the agent and honor its await gates (#337) until it stops asking: resolve each gate to
 * the user's answer, re-prompt with it, and repeat up to {@link MAX_AWAIT_ROUNDS}. When a live-chat
 * {@link AwaitRoundsOptions.messages} source is wired, the run then stays open for the user's own
 * messages (#714) rather than finishing.
 *
 * Every turn here is a turn like any other, so each one's signals are emitted. That is the
 * point of sharing this: the direct prompt path and the backlog loop each had their own copy
 * of these rounds, and the emission had to be added to each by hand (#563).
 */
export async function runAwaitRounds(opts: AwaitRoundsOptions): Promise<AwaitRoundsResult> {
  const { session, emit, emitTurnSignals, messages } = opts
  const deps: AwaitTurnDeps = {
    requestChoice: opts.requestChoice,
    emit,
    emitTurnSignals,
    signal: opts.signal,
  }
  const signalOpt = opts.signal ? { signal: opts.signal } : {}

  // Resuming a finished run (#720): the opening message continues the seeded session, so the
  // agent replies with full prior context. A fresh run leaves `resume` unset — unchanged.
  const opening = await session.prompt(opts.prompt, { ...signalOpt, ...(opts.resume ? { resume: true } : {}) })
  emitTurnSignals(opening.text)
  const drained = await drainGates(opening, deps, promptContinuation(session, deps))

  // A stopping answer (#358) ends the exchange here rather than opening chat on it: the user
  // said stop, and a composer waiting for their next message is not what stopping looks like.
  if (drained.stopped) return { text: drained.turn.text, exhausted: false, stopped: true }

  // Live chat (#714): take the user's messages — draining what queued and ending on idle, or
  // parked until Stop for a terminal-dashboard run (#1390). Headless leaves it unset,
  // so the run ends here exactly as before. Once chat runs, its settled state is the run's end
  // reason, not the opening drain's (#742) — otherwise a chat closed by Stop would still be
  // reported "exhausted" and log a spurious await-limit notice.
  if (messages) {
    const chat = await runChatPhase(session, messages, drained.turn, deps, opts.stayOpenChat === true)
    return { text: chat.turn.text, exhausted: chat.exhausted, stopped: chat.stopped }
  }
  return { text: drained.turn.text, exhausted: drained.exhausted, stopped: false }
}

/** The recommended fallback pick when a single-select gate cannot get a real answer. */
const PROCEED: ChoicePick = { picked: 'proceed', by: 'auto' }

/**
 * Resolve with the human's pick, or fall back to `fallback` if the pick rejects or
 * the run aborts first (user stop / budget cap #322) — so a gate parked for input
 * never hangs. Never rejects. Cleans up its abort listener either way. The fallback
 * is the single-select `proceed` by default; a multi-select passes its default set.
 */
function raceChoiceOrAbort(
  pick: Promise<ChoicePick>,
  signal?: AbortSignal,
  fallback: ChoicePick = PROCEED,
): Promise<ChoicePick> {
  if (!signal) return pick.catch(() => fallback)
  if (signal.aborted) return Promise.resolve(fallback)
  return new Promise<ChoicePick>(resolve => {
    const onAbort = () => resolve(fallback)
    signal.addEventListener('abort', onAbort, { once: true })
    const done = (value: ChoicePick) => {
      signal.removeEventListener('abort', onAbort)
      resolve(value)
    }
    pick.then(done, () => done(fallback))
  })
}

/** One option of a {@link requestChoices} single-select gate (#304). */
export interface ChoicesOption {
  /** Stable id returned when this option is picked. */
  id: string
  /** The label shown next to the option. */
  label: string
  /** Optional one-line detail under the label. */
  detail?: string
}

/** Inputs to {@link requestChoices}. */
export interface ChoicesDeps {
  /** Stable id for the gate; the pick is posted back against it. */
  id: string
  /** The prompt shown above the options. */
  title: string
  /** The options to choose between (pick one). */
  options: readonly ChoicesOption[]
  /** The option id pre-selected (autopilot auto-accepts it) and used as the headless/abort fallback. Default = the first option. */
  recommended?: string
  /** The markdown file under approval; the dashboard's doc sidebar renders it. */
  file?: string
  /** The interactive handler (the CLI wires it to the dashboard); omit for a headless run. */
  requestChoice?: (req: ChoiceRequest) => Promise<ChoicePick>
  /** Emit the `choice` / `choice-resolved` events onto the run stream. */
  emit: (event: FrameworkEvent) => void
  /** The run signal; a gate parked for a pick unblocks (to the recommended option) if the run aborts. */
  signal?: AbortSignal
}

/**
 * The single-select gate (#304): show the options with the recommended one
 * pre-selected, pause, and resolve to the *one* option id the user picked. The twin
 * of {@link requestMultiSelect} for "pick one" — the agent-facing `showChoices()`
 * from the built-in system (#326) prompt and the [Research] preset (#331) both build on it.
 * A headless run (no `requestChoice`), or one aborted mid-await, falls back to the
 * recommended option without hanging, so a programmatic run stays deterministic.
 */
export async function requestChoices(deps: ChoicesDeps): Promise<string> {
  const { options, requestChoice, emit } = deps
  const recommended = deps.recommended ?? options[0]?.id ?? ''
  const req: ChoiceRequest = {
    id: deps.id,
    title: deps.title,
    options: options.map(o => ({ id: o.id, label: o.label, ...(o.detail ? { detail: o.detail } : {}) })),
    ...(recommended ? { recommended } : {}),
    ...(deps.file ? { file: deps.file } : {}),
  }
  emit({ kind: 'choice', ...req })

  const validIds = new Set(options.map(o => o.id))
  const fallback: ChoicePick = { picked: recommended, by: 'auto' }
  // Headless: no one to ask, so accept the recommended option.
  const pick = requestChoice
    ? await raceChoiceOrAbort(requestChoice(req), deps.signal, fallback)
    : fallback
  const picked = pickedIds(pick.picked)[0] ?? ''
  const resolved = validIds.has(picked) ? picked : recommended
  emit({ kind: 'choice-resolved', id: req.id, picked: resolved, by: pick.by ?? 'user' })
  return resolved
}

/** One option of a {@link requestMultiSelect} checklist (#332). */
export interface MultiSelectOption {
  /** Stable id returned when this option is checked. */
  id: string
  /** The label shown next to the checkbox. */
  label: string
  /** Optional one-line detail under the label. */
  detail?: string
  /** Whether this option starts checked (e.g. a low-rated problem in the [Research] preset #331). */
  default?: boolean
}

/** Inputs to {@link requestMultiSelect}. */
export interface MultiSelectDeps {
  /** Stable id for the gate; the pick is posted back against it. */
  id: string
  /** The prompt shown above the checklist. */
  title: string
  /** The options to choose from (checkboxes). */
  options: readonly MultiSelectOption[]
  /** The interactive handler (the CLI wires it to the dashboard); omit for a headless run. */
  requestChoice?: (req: ChoiceRequest) => Promise<ChoicePick>
  /** Emit the `choice` / `choice-resolved` events onto the run stream. */
  emit: (event: FrameworkEvent) => void
  /** The run signal; a gate parked for a pick unblocks (to the defaults) if the run aborts. */
  signal?: AbortSignal
}

/**
 * The multi-select gate (#332): show a checklist with the default-checked options
 * pre-selected, pause, and resolve to the *subset* of option ids the user kept
 * checked. Built on the same `choice` gate + POST-back resolver as the single-select
 * plan-approval gate (#304), just in checklist mode. A headless run (no
 * `requestChoice`) auto-accepts the default set without pausing, so a programmatic
 * run stays deterministic. This is the primitive the [Research] preset (#331) uses
 * to let the user pick which problems to deep-dive.
 */
export async function requestMultiSelect(deps: MultiSelectDeps): Promise<string[]> {
  const { options, requestChoice, emit } = deps
  const defaults = options.filter(o => o.default).map(o => o.id)
  const req: ChoiceRequest = {
    id: deps.id,
    title: deps.title,
    multi: true,
    options: options.map(o => ({
      id: o.id,
      label: o.label,
      ...(o.detail ? { detail: o.detail } : {}),
      ...(o.default ? { default: true } : {}),
    })),
  }
  emit({ kind: 'choice', ...req })

  const validIds = new Set(options.map(o => o.id))
  const asDefaults: ChoicePick = { picked: defaults, by: 'auto' }
  // Headless: no one to ask, so accept the defaults (the recommended set).
  const pick = requestChoice
    ? await raceChoiceOrAbort(requestChoice(req), deps.signal, asDefaults)
    : asDefaults
  const selected = pickedIds(pick.picked).filter(id => validIds.has(id))
  emit({ kind: 'choice-resolved', id: req.id, picked: selected, by: pick.by ?? 'user' })
  return selected
}
