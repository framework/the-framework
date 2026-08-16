import type { FrameworkEvent } from './events.js'
import { PROTOCOLS_BROWSER, PROTOCOLS_AWAIT, PROTOCOLS_HANDS_OFF, PROTOCOLS_SIGNAL } from './prompts.generated.js'
import type { ChoicesOption } from './await-gate.js'
import type { MultiSelectOption } from './await-gate.js'

/**
 * The framework-owned "await" protocol (#337 / #339): the *code side* of the
 * `showChoices()` / `showMultiSelect()` + `AWAIT` macros the system prompt delegates. The
 * driver runs each agent turn as a black box to completion (#165), so the only way
 * the framework can learn the agent stopped to ask (rather than deciding for itself)
 * is a signal in the turn's final message. This appends one to the system prompt: it
 * does not restate the macros, it pins *how* to emit an awaited choice so the
 * turn-boundary gate can detect it. Kept minimal and self-contained so it survives the
 * #326 wording still being written. The text lives in `prompts/protocols/await.md` (#551).
 */
export const AWAIT_PROTOCOL = PROTOCOLS_AWAIT

/**
 * Told to a hands-off agent only (#1234): the await gates {@link AWAIT_PROTOCOL} just taught are
 * not available in this session, so an ambiguous prompt takes its most plausible reading instead
 * of parking forever on a question nobody attached can answer. Worded as availability rather
 * than as a rule, so it deletes itself cleanly once choices become a per-session capability.
 * The text lives in `prompts/protocols/hands_off.md`.
 */
export const HANDS_OFF_PROTOCOL = PROTOCOLS_HANDS_OFF

/**
 * Told to the agent only when the agent has a browser (#824): that it has one, and that anything
 * it needs to see or act on goes through the chrome-devtools tools rather than `WebFetch`.
 * Lives in `prompts/protocols/browser.md`.
 */
export const BROWSER_PROTOCOL = PROTOCOLS_BROWSER

/**
 * The session-lifecycle protocol (#326): the code side of the `setSessionName()` and
 * `setReadyForMerge()` actions the system prompt calls out. Like {@link AWAIT_PROTOCOL},
 * it does not restate *when* to act — the system prompt owns that — it only pins *how* to
 * emit the signal so the turn-boundary can detect it. Both are non-blocking: the agent
 * emits the block and keeps going (the framework records it and reflects it in the
 * dashboard). Injected alongside AWAIT_PROTOCOL. The text lives in
 * `prompts/protocols/signal.md` (#551).
 */
export const SIGNAL_PROTOCOL = PROTOCOLS_SIGNAL

/** One option of an await gate: what the user picks between. */
export interface AwaitOption {
  /** Stable id the pick is posted back against; synthesized from position when the agent names none. */
  id: string
  /** The option as shown to the user. */
  label: string
  /** An optional one-liner under the label. */
  detail?: string
  /** Starts checked. Only meaningful on a {@link ParsedAwaitGate.multi} gate. */
  default?: boolean
  /**
   * Picking this ends the session rather than resuming the agent with it (#358).
   *
   * Some answers are not instructions to carry on, they are "stop, I will take it from here" —
   * declining a plan being the one that matters, because the user's next move is fresh
   * instructions and building on a plan they rejected is the single worst thing to do with the
   * interval. Which answers those are is a property of the question, so the agent marks them,
   * rather than the framework inferring it from a gate kind that no longer exists.
   */
  stop?: boolean
}

/**
 * A question the agent stopped to ask, parsed from an `await-choices` block (#337).
 *
 * There were four of these — a single choice, a multi-select, a plan approval, and handing over a
 * browser — each with its own tag, parser, resolution branch and dashboard card, for what is one
 * question with N options every time. Approve/Decline is two options; "handled it / could not" is
 * two options; a plan approval is that pair with a file attached. Collapsing them means the agent
 * learns one block instead of four, and a new kind of question needs no new code at all.
 */
export interface ParsedAwaitGate {
  /** The question shown above the options. */
  title: string
  /** The options to pick between (at least one, or the gate does not parse). */
  options: AwaitOption[]
  /** The option to default to, which autopilot accepts, when the agent named one. */
  recommended?: string
  /** Any number of options may be picked rather than exactly one, each starting checked per its `default`. */
  multi?: boolean
  /** A markdown file the question is about (a plan under approval); the doc sidebar renders it. */
  file?: string
}

/**
 * How many times the agent may stop to ask, and be resumed, before an agent stops honoring
 * gates and just finishes. A property of the await protocol, so every path that runs gates
 * shares it: a build, a direct prompt, and the backlog loop each used to declare their own.
 */
export const MAX_AWAIT_ROUNDS = 5

/**
 * The prompt that resumes the agent after the user answers a gate. One wording for
 * every path that runs gates (a direct prompt, the backlog loop, a build): the agent
 * already knows what it is working on from the session, so the clause that used to
 * vary per caller ("Continue" / "Continue the backlog entry" / "Continue building X")
 * carried no distinct meaning to it. One constant so a reword lands everywhere at once
 * instead of one path and not the others (#570).
 *
 * No "do not ask again" tail: a capable agent does not re-ask a settled question on
 * its own, so spelling it out is babysitting we leave off until an agent shows it is
 * needed (#570 review).
 */
export function continuationPrompt(question: string, answer: string): string {
  return `You paused to ask: "${question}". The user chose: ${answer}. Continue with that decision.`
}

/**
 * The log line for the other outcome: the user picked a `stop` option, so there is no
 * continuation prompt and the session ends here (#358). Addressed to the user rather than to the
 * agent — the agent is not told anything, which is the point — and it names the answer, because
 * "stopped" on its own reads like a failure when it was a decision.
 */
export function stopMessage(answer: string): string {
  return `Stopped at your answer: ${answer}. Awaiting your instructions.`
}

/** A non-blocking markdown view the agent pushed via a `show-markdown` block (#441). */
export interface ParsedMarkdownView {
  /** Stable id (a slug of the title), so re-showing the same title updates in place. */
  id: string
  /** The view's title (the first `# ` heading, or a fallback). */
  title: string
  /** The markdown body (the heading line removed). */
  markdown: string
}

/** Slugify a title into a stable id, or `fallback` when it has no usable characters. */
function slugify(title: string, fallback: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

/**
 * Parse every `show-markdown` block (per {@link AWAIT_PROTOCOL}) out of a turn's text
 * (#441) — a non-blocking view the agent pushed to the side panel, so a turn may carry
 * several and does not stop. Each block's first `# ` line is the title (the rest is the
 * body); a block with no heading falls back to "Note". Blank blocks are skipped, and two
 * blocks that slug to the same id keep the later one (an in-turn update). Never throws.
 */
export function parseMarkdownViews(text: string): ParsedMarkdownView[] {
  const re = /```show-markdown\s+([\s\S]*?)```/g
  const byId = new Map<string, ParsedMarkdownView>()
  for (const m of text.matchAll(re)) {
    const body = (m[1] ?? '').trim()
    if (!body) continue
    const lines = body.split('\n')
    const heading = /^#\s+(.+)/.exec(lines[0] ?? '')
    const title = heading ? heading[1]!.trim() : 'Note'
    const markdown = (heading ? lines.slice(1).join('\n') : body).trim()
    if (!markdown) continue
    const id = slugify(title, 'view')
    byId.set(id, { id, title, markdown })
  }
  return [...byId.values()]
}

/**
 * Parse the session name the agent set this turn (#326), from the last `set-session-name`
 * block (per {@link SIGNAL_PROTOCOL}) — its first non-empty line, slugified to `[a-z0-9-]`
 * so it matches the branch-name shape. Returns `undefined` when the agent did not set one
 * (the common case) or the block is blank. A later block in the same turn wins (a rename).
 */
export function parseSessionName(text: string): string | undefined {
  const re = /```set-session-name\s+([\s\S]*?)```/g
  let name: string | undefined
  for (const m of text.matchAll(re)) {
    const line = (m[1] ?? '').split('\n').map(l => l.trim()).find(Boolean)
    // Emptiness is tested directly rather than via a fallback sentinel: a sentinel made a
    // session legitimately named `view` indistinguishable from no name at all (#939).
    const slug = line ? slugify(line, '') : ''
    if (slug) name = slug
  }
  return name
}

/**
 * Whether the agent signalled `setReadyForMerge()` this turn (#326): the presence of a
 * `ready-for-merge` block (per {@link SIGNAL_PROTOCOL}) anywhere in the text. Non-blocking
 * and body-less — it just flips the agent from building to ready-for-review.
 */
export function parseReadyForMerge(text: string): boolean {
  return /```ready-for-merge(?:\s[\s\S]*?)?```/.test(text)
}

/** The bodies of every fenced `tag` block in `text`, in the order they appear. */
function blocks(text: string, tag: string): string[] {
  const re = new RegExp('```' + tag + '\\s+([\\s\\S]*?)```', 'g')
  return [...text.matchAll(re)].map(m => m[1] ?? '')
}

/** Parse an await block's JSON body to a record, or `undefined` — the shared first step of
 * every gate parser (it was written out three times). */
function parseRecord(body: string): Record<string, unknown> | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  return raw as Record<string, unknown>
}

/** Read a trimmed string field, or `''`. */
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Parse the await gate a turn ended on (#337), from the last usable `await-choices` block in its
 * text. Returns `undefined` when the agent just finished — the common case, so a normal build
 * flows straight through.
 *
 * Tolerant by design, because a bad parse must never crash a build: ids are synthesized from
 * position when the agent names none, a label-less option is dropped, a blank title falls back,
 * `recommended` may be given as a label or an id, and a malformed block is ignored. A block whose
 * options all fall away is not a gate — the agent carries on rather than parking on an empty question.
 */
export function parseAwaitGate(text: string): ParsedAwaitGate | undefined {
  // Latest first, so the newest question wins — falling back to an earlier one when the agent's
  // last block is malformed, rather than losing a good question to a bad one after it.
  for (const body of blocks(text, 'await-choices').reverse()) {
    const gate = parseGateBody(body)
    if (gate) return gate
  }
  return undefined
}

/** Parse one `await-choices` body, or `undefined` when there is nothing pickable in it. */
function parseGateBody(body: string): ParsedAwaitGate | undefined {
  const record = parseRecord(body)
  if (!record || !Array.isArray(record.options)) return undefined

  const options: AwaitOption[] = []
  ;(record.options as Record<string, unknown>[]).forEach((o, i) => {
    const label = str(o?.label)
    if (!label) return
    const detail = str(o?.detail)
    options.push({
      id: str(o?.id) || `opt:${i}`,
      label,
      ...(detail ? { detail } : {}),
      ...(o?.default === true ? { default: true } : {}),
      ...(o?.stop === true ? { stop: true } : {}),
    })
  })
  if (options.length === 0) return undefined

  const named = str(record.recommended)
  const recommended = named ? (options.find(o => o.id === named) ?? options.find(o => o.label === named))?.id : undefined
  const file = str(record.file)
  return {
    title: str(record.title) || 'Which option?',
    options,
    ...(recommended ? { recommended } : {}),
    ...(record.multi === true ? { multi: true } : {}),
    ...(file ? { file } : {}),
  }
}

/**
 * Emit the {@link PROTOCOLS_SIGNAL} signals an agent turn carries: markdown views, the
 * session name, and `setReadyForMerge()`. Every turn the framework prompts goes through
 * one of these, because the protocols are unconditional (see `composeAgentSystem`) — the
 * agent is told it can signal on any turn, so any turn we don't parse drops the signal.
 *
 * The returned function holds the dedupe state for the turns it covers: `ready-for-merge`
 * fires once, and a session name only re-emits on an actual rename. Each caller makes one
 * for its own span of turns (a build's await rounds, the whole backlog), so keep it for as
 * many turns as should share that dedupe rather than making one per turn.
 */
export function createTurnSignalEmitter(emit: (event: FrameworkEvent) => void): (text: string) => void {
  let named: string | undefined
  let ready = false
  return (text: string): void => {
    for (const view of parseMarkdownViews(text)) emit({ kind: 'view', ...view })
    const name = parseSessionName(text)
    if (name && name !== named) {
      named = name
      emit({ kind: 'session-name', name })
    }
    if (!ready && parseReadyForMerge(text)) {
      ready = true
      emit({ kind: 'ready-for-merge' })
    }
  }
}
