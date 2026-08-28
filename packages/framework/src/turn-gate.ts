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
 * Told to a hands-off agent only (#1225): the session leaves this machine and nothing here sees
 * its workspace, so whatever it produces has to be committed and put in a pull request before it
 * ends. The text lives in `prompts/protocols/hands_off.md`.
 */
export const HANDS_OFF_PROTOCOL = PROTOCOLS_HANDS_OFF


/**
 * Told to the agent only when the agent has a browser (#824): that it has one, and that anything
 * it needs to see or act on goes through the chrome-devtools tools rather than `WebFetch`.
 * Lives in `prompts/protocols/browser.md`.
 */
export const BROWSER_PROTOCOL = PROTOCOLS_BROWSER

/**
 * The session-lifecycle protocol (#326): the code side of the `setReadyForMerge()` action the
 * system prompt calls out, plus the pull request and error blocks. Like {@link AWAIT_PROTOCOL},
 * it does not restate *when* to act — the system prompt owns that — it only pins *how* to
 * emit the signal so the turn-boundary can detect it. All are non-blocking: the agent
 * emits the block and keeps going (the framework records it and reflects it in the
 * dashboard). Injected alongside AWAIT_PROTOCOL. The text lives in
 * `prompts/protocols/signal.md` (#551). The session name is not a signal (#1725): the agent
 * names its branch through `branches name`, and the name is read off the branch.
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
 * What a session that cannot simply be ended is told when the user picks a `stop` option (#358,
 * #1554). A local session is never re-prompted with a stopping answer — it just ends — but a
 * cloud session lives on claude.ai where nothing of ours can end it, so the bridge types this
 * instead: the decision, and that the user is taking over from here.
 */
export function takeoverPrompt(question: string, answer: string): string {
  return `You paused to ask: "${question}". The user chose: ${answer}. Stop here: the user is taking over and will come back with fresh instructions.`
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
 * The longest first line still readable as a title (#1618). Past this the agent wrote a
 * paragraph, not a name for its work, and the block is taken as body alone — a pull request
 * whose title runs to a paragraph is a squash-merge subject that runs to a paragraph.
 */
const MAX_PR_TITLE = 100

/** What the agent asked the framework to open a pull request with (#1567/#1618). */
export interface ParsedPullRequest {
  /** The agent's name for the work: the block's first line, when it reads as a title. */
  title?: string
  /** What changed and why: everything after that line, or the whole block when there is no title. */
  description?: string
}

/**
 * Parse the pull request the agent asked for this turn (#1567), from the last non-empty
 * `open-pr` block (per {@link SIGNAL_PROTOCOL}). Returns `undefined` when the agent wrote none,
 * which simply leaves the handoff describing the work itself. A later block in the same turn
 * wins, so an agent may revise it as the work changes.
 *
 * The block is how an agent opens a pull request *through the framework* rather than by
 * reaching for `gh` itself: the title and the description are the agent's, and the handoff keeps
 * the parts that have to be consistent — the ticket's issue reference and recording the number
 * on the agent.
 *
 * Shaped like a commit message, and read like one: the first line names the work, the rest
 * describes it. A first line too long to be a name is not treated as one (#1618) — the block is
 * all description then, and the title falls back to the session's name rather than being cut
 * mid-sentence, which is how a raw prompt ended up as a permanent commit subject.
 */
export function parsePullRequest(text: string): ParsedPullRequest | undefined {
  let parsed: ParsedPullRequest | undefined
  for (const body of blocks(text, 'open-pr')) {
    const trimmed = body.trim()
    if (!trimmed) continue
    const [first = '', ...rest] = trimmed.split('\n')
    const title = first.trim()
    const description = rest.join('\n').trim()
    parsed =
      title.length <= MAX_PR_TITLE
        ? { title, ...(description ? { description } : {}) }
        : { description: trimmed }
  }
  return parsed
}

/** An error the agent reported this turn (#1500), split the way the block is written. */
export interface ParsedError {
  /** What is wrong, in one line: the block's first line. */
  headline: string
  /** What it ran and what that said: everything below the headline, when the agent wrote any. */
  detail?: string
}

/**
 * Parse the errors the agent reported this turn (#1500), from every non-empty `error` block
 * (per {@link SIGNAL_PROTOCOL}), in the order they were written.
 *
 * Unlike the other signals, every block is kept rather than only the last: two different things
 * going wrong in one turn are two errors, and collapsing them would lose one. Blocks that are
 * empty are skipped — an error with nothing to say is not an error.
 */
export function parseErrors(text: string): ParsedError[] {
  const errors: ParsedError[] = []
  for (const body of blocks(text, 'error')) {
    const trimmed = body.trim()
    if (!trimmed) continue
    const [first = '', ...rest] = trimmed.split('\n')
    const detail = rest.join('\n').trim()
    errors.push({ headline: first.trim(), ...(detail ? { detail } : {}) })
  }
  return errors
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
 * Emit the {@link PROTOCOLS_SIGNAL} signals an agent turn carries: markdown views, the errors it
 * reported, the session name, `setReadyForMerge()`, and a pull-request description. Every turn the framework prompts goes through
 * one of these, because the protocols are unconditional (see `composeAgentSystem`) — the
 * agent is told it can signal on any turn, so any turn we don't parse drops the signal.
 *
 * The returned function holds the dedupe state for the turns it covers: `ready-for-merge`
 * fires once, a pull-request description only re-emits on an actual
 * change, and an error is logged once however often the agent restates it. Each caller makes one
 * for its own span of turns (a build's await rounds, the whole backlog), so keep it for as
 * many turns as should share that dedupe rather than making one per turn.
 */
export function createTurnSignalEmitter(emit: (event: FrameworkEvent) => void): (text: string) => void {
  let ready = false
  let described: string | undefined
  const reported = new Set<string>()
  return (text: string): void => {
    for (const view of parseMarkdownViews(text)) emit({ kind: 'view', ...view })
    for (const error of parseErrors(text)) {
      // Reported once per span (#1500): agents restate their blocks turn after turn, and the
      // same failure logged ten times reads as ten failures. The whole block keys it, so a
      // second attempt that fails differently is still its own error.
      const key = `${error.headline}\n${error.detail ?? ''}`
      if (reported.has(key)) continue
      reported.add(key)
      emit({ kind: 'error', ...error })
    }
    if (!ready && parseReadyForMerge(text)) {
      ready = true
      emit({ kind: 'ready-for-merge' })
    }
    const pr = parsePullRequest(text)
    const seen = pr && `${pr.title ?? ''}\n${pr.description ?? ''}`
    if (pr && seen !== described) {
      described = seen
      emit({ kind: 'open-pr', ...pr })
    }
  }
}
