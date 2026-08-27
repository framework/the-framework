import { randomUUID } from 'node:crypto'
import { makeEmit } from './session-support.js'
import { nodeGitRunner, type GitRunner } from '@better-skills/branch-management'
import { errorMessage } from '../error-message.js'
import { githubSlugFor } from '../dashboard/github.js'
import { WEB_START_PREFIX } from '../dashboard/web-start-endpoints.js'
import type { Driver, DriverEvent, DriverPromptOptions, DriverSession, DriverStartOptions, DriverTurn } from './types.js'

/**
 * A {@link Driver} that hands the task to **Claude Code on the web** (#610): it has a cloud
 * session created on claude.ai and returns its id and URL.
 *
 * The session is created by the browser extension, in the user's own signed-in browser,
 * through claude.ai's repository picker (#1328): the run asks its daemon to queue the request
 * — the repository, the pushed hand-off ref, the prompt — and the extension drives the page
 * and reports the session it became. A session created that way is bound to the repository,
 * so it can push its work and open its pull request; the CLI's own `--cloud` flag, the earlier
 * mechanism, produced on some accounts a bundle upload that never could (#1320), and is gone.
 * The account, the auth and the quota are the user's, exactly as with the local driver (#495).
 *
 * So a web run needs four things, and names whichever is missing: a daemon that spawned it
 * (the daemon's URL travels in the run's environment), the browser bridge switched on, the
 * extension present, and a GitHub remote for the picker to name.
 *
 * **What this target is, and is not.** It is a hand-off: the session runs on Anthropic's
 * infrastructure, does its own git worktree and opens its own PR, at 0% local CPU — the
 * whole point of #610. What it is not is a streamed peer like the local, device and
 * Actions targets, and that is not a shortcut in this implementation but a property of
 * the surface: a cloud session exposes **no read-back API** of any kind — no status, no
 * transcript, no output endpoint, only the session URL. So the turn resolves once the
 * session is created, and following the work happens on claude.ai, through the browser
 * bridge's mirror and gate relay (#1237/#1554), or by pulling it back with
 * `claude --teleport <id>`.
 *
 * For the same reason there is no `readCode`: the workspace lives in a cloud VM this
 * machine never sees.
 */
export class CloudDriver implements Driver {
  readonly id = 'claude-web'
  constructor(private readonly opts: CloudDriverOptions = {}) {}

  start(opts: DriverStartOptions): Promise<DriverSession> {
    return Promise.resolve(new CloudSession(this.opts, opts))
  }

  // No `readQuota`: a cloud session draws on the same subscription the local driver
  // already reports, and there is nothing extra to ask a session we cannot query.
}

/**
 * How a run reaches its daemon's session start-queue (#1328): the daemon's URL, put in the run's
 * environment when it was spawned, and the daemon token from the registry.
 */
export interface ExtensionStart {
  daemonUrl: string
  token: string
  /** Injected in tests; defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** How often to ask where the request stands, in ms. Default 2000. */
  pollMs?: number
}

/** Options for {@link CloudDriver}. */
export interface CloudDriverOptions {
  /**
   * The daemon whose start-queue the browser extension drains (#1328). Absent on a run no
   * daemon spawned, which then has nobody to create its session and fails saying so.
   */
  extension?: ExtensionStart
  /** Give up on session creation after this long, in ms. Default 120000. */
  timeoutMs?: number
  /** Runs git for the pre-hand-off push (#1320). Injected in tests; defaults to real git. */
  git?: GitRunner
  /**
   * Unique tag mixed into the session id. Default a random token. Injected in tests for a
   * stable id, and load-bearing in production for the same reason it is in the Actions
   * driver: a fresh `framework run` process restarts the counter, so without it every
   * run's first session would carry the same id.
   */
  agentTag?: () => string
}

/** Counter feeding the per-process half of a session id. */
let sessionCounter = 0

export const CLOUD_PROMPT_SEPARATOR = '==============================='

/**
 * The prompt handed to the cloud session (#1497): the task first, then every block The Framework
 * injects — the framing, a per-call system — behind a labeled rule. On claude.ai this string is
 * read by a human, and the task is what they open the session to find.
 */
export function cloudHandOffPrompt(task: string, ...injected: (string | undefined)[]): string {
  const blocks = injected.filter((part): part is string => Boolean(part))
  if (blocks.length === 0) return task
  const rule = `\n\n\n${CLOUD_PROMPT_SEPARATOR}\n\n\n`
  const header = 'Instructions from The Framework, the tool that started this session:'
  return `${task}${rule}${header}\n\n${blocks.join(rule)}`
}

/** What a web run is missing when it cannot hand off, each named so the fix is the message. */
const NO_DAEMON = '[framework] claude-web: this run was not started by a daemon, so nothing can hand it to the browser extension — start web runs from the dashboard.'
const NO_REMOTE = '[framework] claude-web: no GitHub remote here — the cloud session is created on a repository the browser extension picks on claude.ai, so the project needs an `origin` on GitHub.'
const NO_EXTENSION = '[framework] claude-web: no browser extension has spoken to this daemon recently — install or reload The Framework extension on a claude.ai tab (and keep the browser bridge on in Settings), then start the run again.'
const BRIDGE_OFF = '[framework] claude-web: the browser bridge is off — turn it on in Settings so the extension can create the cloud session.'

export class CloudSession implements DriverSession {
  readonly id: string
  readonly cwd: string
  private readonly emit: (event: DriverEvent) => void
  private readonly framing: string | undefined
  private readonly controllers = new Set<AbortController>()
  private disposed = false
  /** The cloud session this agent was handed to, once it exists. Set at most once. */
  private handedOff: { url: string; sessionId: string } | undefined
  /** The hand-off anchor commit (#1601), once it is on origin. Set at most once, with the hand-off. */
  private anchorSha: string | undefined

  constructor(
    private readonly config: CloudDriverOptions,
    private readonly startOpts: DriverStartOptions,
  ) {
    const tag = (config.agentTag ?? (() => randomUUID().slice(0, 8)))()
    this.id = `cloud-${++sessionCounter}-${tag}`
    this.cwd = startOpts.cwd
    this.emit = makeEmit(startOpts.onEvent, 'claude-web')
    this.framing = startOpts.system
  }

  async prompt(text: string, opts: DriverPromptOptions = {}): Promise<DriverTurn> {
    if (this.disposed) throw new Error('[framework] claude-web session disposed')
    const full = cloudHandOffPrompt(text, this.framing, opts.system)
    this.emit({ type: 'start', prompt: full })

    // Already handed off: say so and spend nothing. This is the guard that keeps one agent to
    // one cloud session however many times the loop comes back round.
    if (this.handedOff) return this.report(this.handedOff, 'again')

    const controller = new AbortController()
    this.controllers.add(controller)
    for (const signal of [this.startOpts.signal, opts.signal]) {
      if (!signal) continue
      if (signal.aborted) {
        this.controllers.delete(controller)
        throw new Error('[framework] claude-web prompt aborted')
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000)

    try {
      const ext = this.config.extension
      if (!ext) throw new Error(NO_DAEMON)
      const git = this.config.git ?? nodeGitRunner()
      const slug = await githubSlugFor(this.cwd, git)
      if (!slug) throw new Error(NO_REMOTE)

      // The pre-hand-off push (#1320): the cloud session opens on a named origin ref, so the
      // repository picker's branch list must offer this run's starting point. What gets pushed is
      // not HEAD itself but the hand-off anchor (#1601): an empty commit on top of it, so the ref
      // is recognizably this run's and a later sweep can tell it from a branch a person made.
      // Minting and pushing are one step: a checkout that cannot mint an empty commit on its
      // HEAD has no HEAD to push either. A push that fails fails the run — the session cannot
      // open on a ref origin does not have.
      let anchor: string
      try {
        anchor = (await git(['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', `[The Framework] web hand-off ${this.id}`], this.cwd)).trim()
        await git(['push', 'origin', `${anchor}:refs/heads/${this.id}`], this.cwd)
      } catch (err) {
        throw new Error(`[framework] claude-web: could not push the hand-off ref ${this.id} to origin (${errorMessage(err)}) — the cloud session opens on that ref, so the project needs a pushable GitHub remote.`)
      }

      const found = await this.createViaExtension(ext, `${slug.owner}/${slug.repo}`, this.id, full, this.startOpts.model, controller.signal)
      this.anchorSha = anchor
      this.handedOff = found
      return this.report(found, 'first')
    } catch (err) {
      // A user abort (Stop, the agent signal) lands here too; name it what it was.
      if (this.startOpts.signal?.aborted || opts.signal?.aborted) throw new Error('[framework] claude-web prompt aborted')
      throw err
    } finally {
      clearTimeout(timer)
      this.controllers.delete(controller)
    }
  }

  /**
   * Hand the session request to the daemon's start-queue and wait for the extension's word
   * (#1328). Throws, naming the cure, when the daemon has no extension to ask (409) or the
   * bridge is off (404); throws with the extension's own note when it tried and could not create
   * the session; throws when the wait was aborted or timed out. The model the run was started
   * with travels along (#1697): the extension picks it in claude.ai's model menu, so a web run
   * honours the choice the way a local one does instead of dropping it on the page's default.
   */
  private async createViaExtension(
    ext: ExtensionStart,
    repo: string,
    ref: string,
    prompt: string,
    model: string | undefined,
    signal: AbortSignal,
  ): Promise<{ url: string; sessionId: string }> {
    const doFetch = ext.fetch ?? fetch
    const base = ext.daemonUrl.replace(/\/+$/, '')
    const headers = { authorization: `Bearer ${ext.token}` }
    const queued = await doFetch(`${base}${WEB_START_PREFIX}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ repo, branch: ref, prompt, ...(model ? { model } : {}) }),
      signal,
    })
    if (queued.status === 409) throw new Error(NO_EXTENSION)
    if (queued.status === 404) throw new Error(BRIDGE_OFF)
    if (!queued.ok) throw new Error(`[framework] claude-web: the daemon refused the session request (${queued.status}): ${(await queued.text()).slice(0, 300)}`)
    const { id } = (await queued.json()) as { id: string }
    this.emit({ type: 'notice', message: `[framework] claude-web: asked the browser extension to create the cloud session on ${repo} at ${ref}${model ? ` on ${model}` : ''} (request ${id}).` })

    const pollMs = ext.pollMs ?? 2000
    for (;;) {
      if (signal.aborted) throw new Error('[framework] claude-web: gave up waiting for the browser extension to create the session.')
      const res = await doFetch(`${base}${WEB_START_PREFIX}/${id}`, { headers, signal })
      if (!res.ok) throw new Error(`[framework] claude-web: lost the session request ${id} (${res.status})`)
      const state = (await res.json()) as { state: string; sessionId?: string; url?: string; note?: string }
      if (state.state === 'created' && state.sessionId && state.url) return { url: state.url, sessionId: state.sessionId }
      if (state.state === 'failed') {
        throw new Error(`[framework] claude-web: the browser extension could not create the session${state.note ? ` — ${state.note}` : ''}.`)
      }
      await new Promise<void>(resolve => {
        const t = setTimeout(resolve, pollMs)
        signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
      })
    }
  }

  /**
   * Report where this agent went. The `first` hand-off emits the `cloud <url>` action the agent
   * view links through to — mirroring the Actions driver's `run <url>` — and a later pass
   * says the work is already there, so a loop that keeps prompting cannot read the same turn
   * as fresh progress and cannot spend a second session.
   */
  private report(session: { url: string; sessionId: string }, when: 'first' | 'again'): DriverTurn {
    if (when === 'first') this.emit({ type: 'action', label: `cloud ${session.url}` })
    const summary =
      when === 'first'
        ? ['Handed off to Claude Code on the web.', '', `View the session: ${session.url}`, `Continue it here: claude --teleport ${session.sessionId}`].join('\n')
        : [
            'This run was already handed off to Claude Code on the web, so there is nothing further to do here.',
            'The work continues in that cloud session, which opens its own pull request.',
            '',
            `View the session: ${session.url}`,
            `Continue it here: claude --teleport ${session.sessionId}`,
          ].join('\n')
    // The result also carries the session's real URL (#1317) and the hand-off anchor (#1601):
    // the action above is what the agent view links through, the result is what reaches the meta.
    this.emit({
      type: 'result',
      text: summary,
      sessionId: session.sessionId,
      sessionLink: session.url,
      ...(this.anchorSha ? { anchorSha: this.anchorSha } : {}),
    })
    return { text: summary, sessionId: session.sessionId }
  }

  // No `readCode`: the cloud VM's workspace is not on this machine, and the branch it
  // pushes is not known until it pushes one.

  async dispose(): Promise<void> {
    this.disposed = true
    for (const controller of this.controllers) controller.abort()
    this.controllers.clear()
  }
}

