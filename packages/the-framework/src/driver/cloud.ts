import { randomUUID } from 'node:crypto'
import { spawn as nodeSpawn } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { killTree, registerChild, unregisterChild } from './child-registry.js'
import { combineFraming, makeEmit } from './session-support.js'
import type { Driver, DriverEvent, DriverPromptOptions, DriverSession, DriverStartOptions, DriverTurn } from './types.js'

/**
 * A {@link Driver} that hands the task to **Claude Code on the web** (#610): it starts a
 * real cloud session on claude.ai and returns its id and URL.
 *
 * The mechanism is the CLI's own `--cloud` flag, so the account, the auth and the
 * quota are the user's, exactly as with the local driver (#495). Nothing here drives
 * the claude.ai UI: no browser, no extension, no scraping — the two earlier candidates
 * for this issue, both of which the Usage Policy rules out.
 *
 * **Why a pty.** `--cloud` refuses to run when stdout is a pipe, because a non-interactive
 * invocation would silently run locally instead. That check is about the *terminal*, not
 * about a human, so running the CLI under a pty satisfies it. `script` supplies the pty
 * (present on macOS and Linux) and the prompt travels in the environment, never inside a
 * shell string — the command string is a fixed literal, so no prompt text can reach the
 * shell as syntax.
 *
 * **What this target is, and is not.** It is a hand-off: the session runs on Anthropic's
 * infrastructure, does its own git worktree and opens its own PR, at 0% local CPU — the
 * whole point of #610. What it is not is a streamed peer like the local, device and
 * Actions targets, and that is not a shortcut in this implementation but a property of
 * the surface: a cloud session exposes **no read-back API** of any kind — no status, no
 * transcript, no output endpoint, only the session URL. So the turn resolves once the
 * session is created, and following the work happens on claude.ai, or by pulling it back
 * with `claude --teleport <id>`.
 *
 * For the same reason there is no `readCode`: the workspace lives in a cloud VM this
 * machine never sees.
 */
export class CloudDriver implements Driver {
  readonly name = 'claude-web'
  constructor(private readonly opts: CloudDriverOptions = {}) {}

  start(opts: DriverStartOptions): Promise<DriverSession> {
    return Promise.resolve(new CloudSession(this.opts, opts))
  }

  // No `readQuota`: a cloud session draws on the same subscription the local driver
  // already reports, and there is nothing extra to ask a session we cannot query.
}

/** Options for {@link CloudDriver}. */
export interface CloudDriverOptions {
  /** Claude Code binary. Default `"claude"`. */
  bin?: string
  /** Give up on session creation after this long, in ms. Default 120000. */
  timeoutMs?: number
  /** Run one pty-hosted invocation. Injected in tests; defaults to a real `script` pty. */
  runPty?: RunPty
  /**
   * Unique tag mixed into the session id. Default a random token. Injected in tests for a
   * stable id, and load-bearing in production for the same reason it is in the Actions
   * driver: a fresh `framework run` process restarts the counter, so without it every
   * run's first session would carry the same id.
   */
  runTag?: () => string
}

/** One pty-hosted invocation: stream its output, resolve when it ends. */
export type RunPty = (opts: RunPtyOptions) => Promise<void>

/** What {@link RunPty} needs to run one invocation. */
export interface RunPtyOptions {
  /** Claude Code binary to run under the pty. */
  bin: string
  /** The prompt, handed over through the environment rather than the command line. */
  prompt: string
  /** Model id to pass through, when one was chosen. */
  model?: string | undefined
  /** Workspace the CLI runs in — the repo whose remote the cloud session clones. */
  cwd: string
  /** Called with each chunk of terminal output. */
  onData: (chunk: string) => void
  /** Stop the invocation: the caller has what it needs, or the run was aborted. */
  signal: AbortSignal
}

/** Counter feeding the per-process half of a session id. */
let sessionCounter = 0

/** Control sequences a terminal emits around the text we actually want to read. */
const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b[()][A-Z]|\x1b[=>]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g

/** The session link the CLI prints once the cloud session exists. */
const SESSION_URL = /https:\/\/claude\.ai\/code\/(session_[A-Za-z0-9]+)\S*/

/**
 * The workspace-trust question, matched with every space removed so a terminal that draws
 * the words with cursor moves rather than literal spaces still matches. The driver does not
 * answer it: trusting a workspace is the user's call to make once, in their own terminal,
 * not something a background run should decide on their behalf. It is detected only so the
 * run says what it is parked on instead of timing out with nothing to show.
 */
const TRUST_PROMPT = 'trustthisfolder'

/** Model ids we will pass through, kept to characters that cannot act as shell syntax. */
const SAFE_MODEL = /^[A-Za-z0-9._:-]+$/

/**
 * One hand-off to Claude Code on the web. Each {@link prompt} creates its **own** cloud
 * session: the CLI can start a session and pull one back, but it cannot send a second
 * message to one, so there is no continuation to hold on to. A follow-up message therefore
 * starts a fresh cloud session rather than pretending to continue the first.
 */
export class CloudSession implements DriverSession {
  readonly id: string
  readonly cwd: string
  private readonly emit: (event: DriverEvent) => void
  private readonly framing: string | undefined
  private readonly controllers = new Set<AbortController>()
  private disposed = false

  constructor(
    private readonly config: CloudDriverOptions,
    private readonly startOpts: DriverStartOptions,
  ) {
    const tag = (config.runTag ?? (() => randomUUID().slice(0, 8)))()
    this.id = `cloud-${++sessionCounter}-${tag}`
    this.cwd = startOpts.cwd
    this.emit = makeEmit(startOpts.onEvent, 'claude-web')
    this.framing = startOpts.system
  }

  async prompt(text: string, opts: DriverPromptOptions = {}): Promise<DriverTurn> {
    if (this.disposed) throw new Error('[framework] claude-web session disposed')
    const full = combineFraming(this.framing, opts.system, text)
    this.emit({ type: 'start', prompt: full })

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

    const timeoutMs = this.config.timeoutMs ?? 120_000
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const model = this.startOpts.model
    if (model !== undefined && !SAFE_MODEL.test(model)) {
      clearTimeout(timer)
      this.controllers.delete(controller)
      throw new Error(`[framework] claude-web: unsafe model id ${JSON.stringify(model)}`)
    }

    let output = ''
    let trusting = false
    let found: { url: string; sessionId: string } | undefined
    try {
      await (this.config.runPty ?? runPtyWithScript)({
        bin: this.config.bin ?? 'claude',
        prompt: full,
        model,
        cwd: this.cwd,
        signal: controller.signal,
        onData: chunk => {
          output += chunk
          if (found) return
          const clean = output.replace(ANSI, '')
          const match = SESSION_URL.exec(clean)
          if (match) {
            found = { url: match[0], sessionId: match[1]! }
            // The link is what the dashboard needs; the CLI has nothing further to say
            // and would otherwise sit holding the terminal, so stop it here.
            controller.abort()
            return
          }
          if (!trusting && clean.replace(/\s+/g, '').includes(TRUST_PROMPT)) {
            trusting = true
            this.emit({
              type: 'notice',
              message: `Claude Code has not been trusted in ${this.cwd} yet, so it is asking before it will start. Run \`claude\` there once and accept, then try this again.`,
            })
            controller.abort()
          }
        },
      })
    } finally {
      clearTimeout(timer)
      this.controllers.delete(controller)
    }

    if (!found) throw new Error(`[framework] claude-web: no cloud session was created.\n${tail(output.replace(ANSI, ''))}`)

    // `cloud <url>` mirrors the Actions driver's `run <url>`: the one event the run view
    // reads to link through to where the work actually is.
    this.emit({ type: 'action', label: `cloud ${found.url}` })
    const summary = [
      'Handed off to Claude Code on the web.',
      '',
      `View the session: ${found.url}`,
      `Continue it here: claude --teleport ${found.sessionId}`,
    ].join('\n')
    this.emit({ type: 'result', text: summary, sessionId: found.sessionId })
    return { text: summary, sessionId: found.sessionId }
  }

  // No `readCode`: the cloud VM's workspace is not on this machine, and the branch it
  // pushes is not known until it pushes one.

  async dispose(): Promise<void> {
    this.disposed = true
    for (const controller of this.controllers) controller.abort()
    this.controllers.clear()
  }
}

/** Keep the tail of a failed invocation's output, enough to show the reason. */
function tail(text: string, max = 600): string {
  const trimmed = text.trim()
  return trimmed.length <= max ? trimmed : `...${trimmed.slice(-max)}`
}

/**
 * The shell command `script` hosts. A **fixed literal**: the prompt and the model arrive
 * as environment variables, so nothing the user typed is ever parsed as shell syntax.
 * `${FW_CLOUD_MODEL:+...}` adds the model flag only when one was chosen.
 */
const CLOUD_COMMAND = 'exec "$FW_CLOUD_BIN" --cloud ${FW_CLOUD_MODEL:+--model "$FW_CLOUD_MODEL"} "$FW_CLOUD_PROMPT"'

/**
 * Run the CLI under a pty supplied by `script`, streaming its terminal output.
 *
 * `script`'s two dialects differ: BSD (macOS) takes the typescript file then the command
 * as argv, util-linux (Linux) takes `-c <command>` then the file. Both get the same fixed
 * command string, so the difference is confined to argv order.
 */
function runPtyWithScript(opts: RunPtyOptions): Promise<void> {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      FW_CLOUD_BIN: opts.bin,
      FW_CLOUD_PROMPT: opts.prompt,
      ...(opts.model !== undefined ? { FW_CLOUD_MODEL: opts.model } : {}),
    }
    const args =
      process.platform === 'darwin'
        ? ['-q', '/dev/null', 'sh', '-c', CLOUD_COMMAND]
        : ['-qec', CLOUD_COMMAND, '/dev/null']
    // stdin must be a FILE. BSD `script` reads its own stdin's terminal attributes to mirror
    // them onto the pty it creates, and a pipe is a socketpair, so it dies with
    // "tcgetattr/ioctl: Operation not supported on socket" before running anything. Under a
    // daemon there is no terminal to inherit either, so the fd has to be something tcgetattr
    // can fail on harmlessly, which a regular file is.
    let dir: string
    let stdin: number
    try {
      dir = mkdtempSync(join(tmpdir(), 'framework-cloud-'))
      const path = join(dir, 'stdin')
      writeFileSync(path, '')
      stdin = openSync(path, 'r')
    } catch (err) {
      rejectPromise(new Error(`[framework] claude-web: could not prepare the pty input (${(err as Error).message})`))
      return
    }
    const cleanup = () => {
      try {
        closeSync(stdin)
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // Best effort: a leftover temp file must not fail a run that otherwise worked.
      }
    }

    const child = nodeSpawn('script', args, { cwd: opts.cwd, env, detached: true, stdio: [stdin, 'pipe', 'pipe'] })
    const pid = child.pid
    if (pid != null) registerChild(pid)
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      if (pid != null) {
        killTree(pid, 'SIGKILL')
        unregisterChild(pid)
      }
      cleanup()
      if (err) rejectPromise(err)
      else resolvePromise()
    }

    // Aborting is the normal ending: the caller stops us the moment the session URL lands.
    opts.signal.addEventListener('abort', () => finish(), { once: true })

    const consume = (chunk: Buffer) => opts.onData(chunk.toString('utf8'))
    child.stdout?.on('data', consume)
    child.stderr?.on('data', consume)
    child.on('error', (err: Error) =>
      finish(new Error(`[framework] claude-web: could not run the CLI under a pty (${err.message}). \`script\` must be on PATH.`)),
    )
    child.on('close', () => finish())
  })
}
