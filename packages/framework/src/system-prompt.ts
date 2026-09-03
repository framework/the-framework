import { renderTemplate } from './prompt-template.js'
import { BRANCH_YOURSELF, SYSTEM_PROMPT, TICKETS_SKILL, TICKETS_YOURSELF } from './prompts.generated.js'
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
 * `agent-<session>` branch before the first change, and the alternatives flow
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
   * The session name, read off the agent's branch (#1725) once it named it. Only the
   * on-before-mergeable prompt reads it, never the system prompt: the name exists before the agent
   * makes changes and is read afterwards, so it is not chicken-and-egg.
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
 * agent both reads at the start of an agent and folds new knowledge back into at merge. The
 * on-before-mergeable prompt's `## Business knowledge` section names this exact set, so the
 * agent is never told to read one set of files and update another (pinned by a test). A
 * subset of {@link CONTEXT_DOCS}.
 */
export const BUSINESS_KNOWLEDGE_DOCS: readonly ContextDoc[] = [DECISIONS_DOC, FACTS_DOC, INSIGHTS_DOC]

/**
 * TEMPORARY (#1748): what an agent outside a checkout the daemon created is told about the
 * tickets and the queue, since nothing links the `tickets` skill into its checkout and the
 * `tickets` command is not on its PATH — the counterpart of {@link BRANCH_YOURSELF}: how to read
 * and write the branch with git, followed by the skill's own formats so they exist in one place.
 * Dies when use-npm-skills commits the skill into the repository.
 */
const TICKETS_BRIDGE = `${TICKETS_YOURSELF}\n\n${TICKETS_SKILL}`

/**
 * Everything the agent keeps in context when it starts (#683), which
 * {@link systemPromptBlock} renders as the `Context:` bullets. A superset of
 * {@link BUSINESS_KNOWLEDGE_DOCS}: it adds `GOAL.md`, `BUSINESS_LOGIC.md`, and the
 * roadmap/queue pointers the agent reads but does *not* fold knowledge back into — the tickets
 * (the potential work) and the agent queue, both the `tickets` skill's (#1748): they live on the
 * `agent-data` branch, and the skill says how to read and change them and what their formats are.
 * Repo-root paths, because that is the agent's cwd. README is left out: a repo's own `README.md`
 * already covers the overview.
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
  { path: 'tickets/**.md', comment: 'things to potentially work on; on the `agent-data` branch — read and change them with the `tickets` skill' },
  { path: 'TODO_AGENTS.md', comment: 'the AI task queue; on the `agent-data` branch — read and change it with the `tickets` skill' },
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
   * This agent has a real browser attached (#824). Adds the section telling the agent so: the
   * tools are wired through MCP, which the agent discovers, but nothing otherwise says to prefer
   * them — so it reaches for `WebFetch`, and the browser (and its preview) sits unused.
   */
  browser?: boolean | undefined
  /**
   * This agent hands off to a remote session whose workspace nothing local sees (#1231), so it
   * has to land its own work: appends {@link HANDS_OFF_PROTOCOL}, the commit-and-open-a-PR rule.
   */
  handsOff?: boolean | undefined
  /**
   * This agent runs in a checkout The Framework created, with `branches` on its PATH
   * (#1725) — a daemon-started agent on this machine. It gets the `branches` skill; any
   * other agent (a plain terminal run in the user's own checkout, a GitHub Actions runner, a cloud
   * session) gets the section that has it branch with git itself.
   */
  ownedCheckout?: boolean | undefined
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
  // In a checkout The Framework created, the `branches` and `tickets` skills are the checkout's
  // (#1739/#1748): the packages link them where the agent's harness looks for skills, and the
  // built-in prompt tells the agent to use them — nothing rides in this channel. Anywhere else
  // the commands are not on the PATH, so the sections that have the agent branch, and read and
  // write the tickets, with git itself follow the prompt. Framework-authored, so `--vanilla`
  // drops them — which is what keeps the on-before-mergeable follow-up from naming a session of
  // its own (#560).
  if (includeBuiltin) parts.push(renderSystemPrompt(opts.tf).system, ...(opts.ownedCheckout ? [] : [BRANCH_YOURSELF, TICKETS_BRIDGE]))
  const user = opts.user?.trim()
  if (user) parts.push(user)
  return parts.join('\n\n')
}

/** Inputs to {@link composeAgentSystem}. */
export type AgentSystemOptions = SystemPromptOptions

/**
 * Assemble an agent's full system channel — the single place it is composed (#501), so the
 * build path and the direct-prompt path, before D2 collapsed them into one {@link runAgent}
 * cannot drift. That drift is exactly what dropped the session-action (#326) layer from `--vanilla`
 * builds (#500): the two sites each inlined the composition and one nested the protocols
 * inside the built-in-prompt branch.
 *
 * Order is fixed: the built-in system prompt (#326) block (context / built-in prompt / user SYSTEM.md)
 * first, then the emit protocols. Nothing else is appended — a build agent's system channel
 * is exactly this (#547), which is what lets the dashboard show the whole prompt before an agent
 * starts (#520). The protocols are otherwise unconditional — they are the *emit contract* (how
 * the agent signals an awaited choice and the setReadyForMerge() lifecycle),
 * not prompt content — so the agent needs them even with the built-in prompt off (`--vanilla`).
 *
 * The one exception is transparent mode (#625): there is no framework behavior to signal to, so
 * the whole channel is empty and the agent runs as raw `claude -p`.
 */
export function composeAgentSystem(opts: AgentSystemOptions = {}): string {
  if (opts.transparent) return ''
  const promptBlock = systemPromptBlock(opts)
  // The browser section rides with the protocols, not with the built-in prompt: like them it
  // describes what this agent can do, so `--vanilla` (no framework prompt) still gets it — the
  // tools are there either way.
  // Ahead of the protocols, so the signal protocol stays the last thing in the channel (#547).
  const browser = opts.browser ? [BROWSER_PROTOCOL] : []
  // The hand-off's land-everything rule after the await protocol — a cloud session's gates are
  // the same as a local one's: it parks, and the answer reaches it through the browser bridge or
  // on claude.ai itself (#1554). The signal protocol stays last (#547).
  const handsOff = opts.handsOff ? [HANDS_OFF_PROTOCOL] : []
  return [...(promptBlock ? [promptBlock] : []), ...browser, AWAIT_PROTOCOL, ...handsOff, SIGNAL_PROTOCOL].join('\n\n')
}
