import { renderTemplate } from './prompt-template.js'
import { SYSTEM_PROMPT, TICKETING_FORMAT, TODO_FORMAT } from './prompts.generated.js'
import { AWAIT_PROTOCOL, BROWSER_PROTOCOL, HANDS_OFF_PROTOCOL, SIGNAL_PROTOCOL } from './turn-gate.js'

// No Node imports here, deliberately. This module composes the prompt and the
// dashboard renders it in the browser (#520), so reading the user's SYSTEM.md off
// disk lives in `system-prompt-file.ts` instead. Keep it that way: one `node:fs`
// import here puts `node:fs` in the browser bundle.

/**
 * The system prompt (#326), verbatim, as a template. It supersedes the
 * anti-lazy-pill (#297/#301) it grew out of: the prompt is analyzed first — an
 * ambiguous one becomes a ranked `showChoices()` list, a
 * large scope becomes a PLAN file to approve, a very large one also spins off a TODO
 * backlog (consumed by the backlog loop, #323), the work moves onto its own
 * `the-framework/<session>` branch before the first change, and the alternatives flow
 * rates problem "variability" before code is written.
 *
 * Two layers make it executable:
 * - `${{ ... }}` fragments are JS evaluated against a {@link TfContext} (#350).
 * - The trailing `# User prompt` section is the user-prompt slot; use
 *   {@link renderSystemPrompt} to render and split the two halves.
 *
 * The `<SHOW_*>` / `<AWAIT>` macros are interpreted by the agent itself (Rom's
 * call on #326); the await protocol (#337/#339) pins how the stop-signal is
 * emitted so the turn-boundary gates can detect it.
 *
 * The text lives in `prompts/system_prompt.md` (#551), not here. It is Rom's living
 * doc: change it on #326 first, then sync the markdown.
 */
export const SYSTEM_PROMPT_TEMPLATE = SYSTEM_PROMPT

/**
 * The `tf` context the templates' `${{...}}` fragments read (#326/#350). One shape across
 * the prompts; each reads the subset it needs. `session_name` is the on-before-mergeable
 * prompt's (#556), and is snake_case because the doc writes it that way.
 */
export interface TfContext {
  /** The user's prompt (the session's intent, or the typed prompt): fills `${{tf.prompt}}`. */
  prompt: string
  /**
   * The session name the agent set via setSessionName(), carried on session state. Only the
   * on-before-mergeable prompt reads it, never the system prompt: it is set before the agent makes
   * changes and read afterwards, so it is not chicken-and-egg.
   */
  session_name?: string | undefined
}

/** The neutral context used when a caller has none: an empty prompt. */
const DEFAULT_TF: TfContext = { prompt: '' }

/** A project-context document: a repo-root path and the one-line gloss shown beside it (#559). */
export interface ContextDoc {
  path: string
  comment: string
}

// The knowledge base lives under `knowledge-base/` (#683): one file per kind rather than a
// single flat doc, so the agent folds each learning back into the right file.
const DECISIONS_DOC: ContextDoc = { path: 'knowledge-base/DECISIONS.md', comment: 'decisions taken, and why' }
const FACTS_DOC: ContextDoc = { path: 'knowledge-base/FACTS.md', comment: 'non-obvious facts relevant to the project' }
const INSIGHTS_DOC: ContextDoc = { path: 'knowledge-base/INSIGHTS.md', comment: 'insights relevant to the project' }

/**
 * The business-knowledge docs (#537): what the repo has learned about itself, which the
 * agent both reads at the start of a run and folds new knowledge back into at merge. The
 * on-before-mergeable prompt's `## Business knowledge` section names this exact set, so the
 * agent is never told to read one set of files and update another (pinned by a test). A
 * subset of {@link CONTEXT_DOCS}.
 */
export const BUSINESS_KNOWLEDGE_DOCS: readonly ContextDoc[] = [DECISIONS_DOC, FACTS_DOC, INSIGHTS_DOC]

/**
 * The two file-format specs, carried in the run's own system channel (#1163).
 *
 * Two of the {@link CONTEXT_DOCS} have a shape the agent has to follow: `tickets/**.md` and
 * `TODO_AGENTS.md`. The #674 call is that their spec ships *inside the package* rather than being
 * materialized into the user's repo, so a change to the format rides with the package version
 * instead of going stale in a committed file. What that call left open is how the agent reads it,
 * and the answer was a path — `node_modules/@gemstack/the-framework/prompts/*.md`.
 *
 * That path only resolves when the framework happens to be a root dependency of the repo it is
 * working on. It is not there for a global or npx install, not there in a fresh worktree before an
 * install, and not there in this repo at all, where the framework is a workspace package rather
 * than a dependency of the root. So the spec was unopenable, and the two files it governs drifted
 * from it (#1163/#1162) with nothing to notice.
 *
 * Carrying the content keeps what #674 wanted — the spec still rides with the package version,
 * and nothing is written into the user's repo — and makes it something the agent has already read
 * rather than something it has to go and find. It is framework-authored prompt content, so like
 * the context bullets it goes with the built-in prompt and `--vanilla` drops it.
 */
const CONTEXT_FORMATS: readonly string[] = [TICKETING_FORMAT, TODO_FORMAT]

/** The heading each spec opens with, so a bullet can name the section that answers it.
 * Must track the spec's own H1 — #1420 renamed it "Ticketing format", and a bullet naming a
 * section that does not exist sends the agent to follow a format it cannot find. */
const TICKET_FORMAT_HEADING = 'Ticketing format'
const TODO_FORMAT_HEADING = 'TODO_AGENTS.md'

/**
 * Everything the agent keeps in context at the start of a run (#683), which
 * {@link systemPromptBlock} renders as the `Context:` bullets. A superset of
 * {@link BUSINESS_KNOWLEDGE_DOCS}: it adds `GOAL.md`, `BUSINESS_LOGIC.md`, and the
 * roadmap/queue/history pointers the agent reads but does *not* fold knowledge back into —
 * `tickets/**.md` (the potential work, whose file shape is the `Ticketing format` spec, #684/#674)
 * and the `TODO_AGENTS.md` task queue (whose shape is the `TODO_AGENTS.md` spec, #880). Repo-root
 * paths, because that is the agent's cwd. README is left out: a repo's own `README.md` already
 * covers the overview.
 *
 * The two format-bearing bullets point at {@link CONTEXT_FORMATS}, which travels in the same
 * channel, rather than at a file the agent has to go and open (#1163).
 */
export const CONTEXT_DOCS: readonly ContextDoc[] = [
  DECISIONS_DOC,
  { path: 'GOAL.md', comment: 'the goal of the project (long-term direction, scope, non-scope, ...)' },
  // The codebase's business logic, documented (#683). Root-level beside GOAL.md, per the OP. A
  // pointer the agent reads, not a doc it folds knowledge back into at merge, so it stays out of
  // BUSINESS_KNOWLEDGE_DOCS.
  { path: 'BUSINESS_LOGIC.md', comment: 'codebase business logic' },
  FACTS_DOC,
  INSIGHTS_DOC,
  // What the market looks like (#694): written by the [Market research] preset and read by the
  // follow-up that turns it into tickets. A pointer the agent reads, not a doc it folds knowledge
  // back into, so it stays out of BUSINESS_KNOWLEDGE_DOCS.
  { path: 'knowledge-base/MARKET_RESEARCH.md', comment: 'the market the project competes in' },
  // The catch-all (#683): any other file the agent parks under knowledge-base/.
  { path: 'knowledge-base/**.md', comment: 'more files holding knowledge related to the project' },
  { path: 'tickets/**.md', comment: `things to potentially work on; format: the "${TICKET_FORMAT_HEADING}" section below` },
  { path: 'TODO_AGENTS.md', comment: `the AI task queue; format: the "${TODO_FORMAT_HEADING}" section below` },
]

/** The two halves of the rendered {@link SYSTEM_PROMPT_TEMPLATE}. */
export interface RenderedSystemPrompt {
  /** The `# System prompt` half: frames the session's system channel. */
  system: string
  /** The `# User prompt` half: the rendered user-prompt slot (`${{tf.prompt}}` plus any framing Rom adds around it). */
  user: string
}

const USER_PROMPT_HEADING = '\n# User prompt\n'

/**
 * Render the built-in system prompt against a {@link TfContext} and split it at
 * the `# User prompt` heading. The split happens on the *template*, before
 * rendering, so a user prompt that itself contains the heading can never move
 * the boundary.
 */
export function renderSystemPrompt(tf: TfContext = DEFAULT_TF): RenderedSystemPrompt {
  const at = SYSTEM_PROMPT_TEMPLATE.indexOf(USER_PROMPT_HEADING)
  const systemHalf = at === -1 ? SYSTEM_PROMPT_TEMPLATE : SYSTEM_PROMPT_TEMPLATE.slice(0, at)
  const userHalf = at === -1 ? '${{tf.prompt}}' : SYSTEM_PROMPT_TEMPLATE.slice(at + USER_PROMPT_HEADING.length)
  return {
    system: renderTemplate(systemHalf, { tf }).trim(),
    user: renderTemplate(userHalf, { tf }).trim(),
  }
}

/** Inputs to {@link systemPromptBlock}. */
export interface SystemPromptOptions {
  /** Remove the built-in #326 system prompt. Default `false` — it is included. */
  vanilla?: boolean | undefined
  /** The user's own system prompt (e.g. from `SYSTEM.md`), injected after the built-in one. */
  user?: string | undefined
  /** Context for the template's `${{...}}` fragments. Default: {@link DEFAULT_TF}. */
  tf?: TfContext | undefined
  /**
   * Directories the user picked as in-context (#439/#314). The agent can reach every
   * registered repo, so this narrows its focus: it prepends one `Context: <dirs>` line to
   * the block. Empty/absent adds nothing.
   */
  context?: readonly string[] | undefined
  /**
   * Transparent mode (#625): drop *everything* framework-authored from the system channel —
   * the built-in prompt, the knowledge docs, AND the emit protocols — so the agent receives an
   * empty system channel, byte-identical to raw `claude -p <prompt>`. This is stronger than
   * `--vanilla` (which keeps the AWAIT/SIGNAL emit contract so the agent can still drive the
   * dashboard's gates); transparent means there is no framework behavior left to signal to.
   * Short-circuits {@link composeAgentSystem}, so it overrides every other option here.
   */
  transparent?: boolean | undefined
  /**
   * This run has a real browser attached (#824). Adds the section telling the agent so: the
   * tools are wired through MCP, which the agent discovers, but nothing otherwise says to prefer
   * them — so it reaches for `WebFetch`, and the browser (and its preview) sits unused.
   */
  browser?: boolean | undefined
  /**
   * This run hands off to a remote session nothing local can steer (#1231), so the await gates
   * are not available in it (#1234). Appends {@link HANDS_OFF_PROTOCOL} right after the await
   * protocol it amends, so an ambiguous prompt takes its most plausible reading and says so,
   * instead of parking a cloud session forever on a question nobody attached can answer.
   */
  handsOff?: boolean | undefined
}

/**
 * Compose the system-prompt block injected into every prompt: the built-in #326
 * prompt (unless removed) followed by the user's own prompt. Additive, so a repo
 * can keep the built-in *and* add its instructions, remove it and keep only its
 * own, or leave both off. Returns `''` when there is nothing to inject. Only the
 * template's system half lands here; the user-prompt half is the caller's to
 * deliver (see {@link renderSystemPrompt}).
 */
export function systemPromptBlock(opts: SystemPromptOptions = {}): string {
  const parts: string[] = []
  // The #439 context line goes first, so it frames whatever prompt follows (or stands
  // alone under `--vanilla`, where there is no built-in prompt to frame).
  const dirs = opts.context?.map(d => d.trim()).filter(Boolean) ?? []
  // The context docs ride with the built-in prompt, not with the user's dirs: they are
  // ours, and `--vanilla` means no framework-authored prompt at all (#547 rule 3). They
  // render as commented bullets under the dirs (#559), so the agent sees what each is for.
  // Vanilla drops both the framework's context docs and its built-in prompt; one boolean drives
  // both so they can't fall out of step.
  const includeBuiltin = opts.vanilla !== true
  const docs = includeBuiltin ? CONTEXT_DOCS : []
  if (dirs.length || docs.length) {
    const head = `Context:${dirs.length ? ` ${dirs.join(', ')}` : ''}`
    const bullets = docs.map(d => `- \`${d.path}\` (${d.comment})`)
    parts.push([head, ...bullets].join('\n'))
  }
  // The formats the two format-bearing bullets name, right under the list that names them (#1163).
  if (includeBuiltin) parts.push(...CONTEXT_FORMATS, renderSystemPrompt(opts.tf).system)
  const user = opts.user?.trim()
  if (user) parts.push(user)
  return parts.join('\n\n')
}

/** Inputs to {@link composeAgentSystem}. */
export type AgentSystemOptions = SystemPromptOptions

/**
 * Assemble a run's full system channel — the single place it is composed (#501), so the
 * build path and the direct-prompt path, before D2 collapsed them into one {@link runAgent}
 * cannot drift. That drift is exactly what dropped the session-action (#326) layer from `--vanilla`
 * builds (#500): the two sites each inlined the composition and one nested the protocols
 * inside the built-in-prompt branch.
 *
 * Order is fixed: the built-in system prompt (#326) block (context / built-in prompt / user SYSTEM.md)
 * first, then the emit protocols. Nothing else is appended — a build run's system channel
 * is exactly this (#547), which is what lets the dashboard show the whole prompt before a run
 * starts (#520). The protocols are otherwise unconditional — they are the *emit contract* (how
 * the agent signals an awaited choice and the setSessionName()/setReadyForMerge() lifecycle),
 * not prompt content — so the agent needs them even with the built-in prompt off (`--vanilla`).
 *
 * The one exception is transparent mode (#625): there is no framework behavior to signal to, so
 * the whole channel is empty and the agent runs as raw `claude -p`.
 */
export function composeAgentSystem(opts: AgentSystemOptions = {}): string {
  if (opts.transparent) return ''
  const promptBlock = systemPromptBlock(opts)
  // The browser section rides with the protocols, not with the built-in prompt: like them it
  // describes what this run can do, so `--vanilla` (no framework prompt) still gets it — the
  // tools are there either way.
  // Ahead of the protocols, so the signal protocol stays the last thing in the channel (#547).
  const browser = opts.browser ? [BROWSER_PROTOCOL] : []
  // Right after the await protocol it amends (#1234): the gates are taught, then declared
  // unavailable, which keeps the emit contract intact for the parser while telling the agent
  // not to reach for it. The signal protocol stays last (#547).
  const handsOff = opts.handsOff ? [HANDS_OFF_PROTOCOL] : []
  return [...(promptBlock ? [promptBlock] : []), ...browser, AWAIT_PROTOCOL, ...handsOff, SIGNAL_PROTOCOL].join('\n\n')
}
