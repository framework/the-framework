import { execFile, spawn as nodeSpawn } from 'node:child_process'
import { runCliSession, type AgentCliParser, type SpawnLike } from './cli-session.js'
import { finishTurn } from './inbox.js'
import { attachLog, type SessionLog } from './session-log.js'
import { combineFraming, combineSignals, makeEmit, readWorkspaceFile } from './session-support.js'
import type { Driver, DriverEvent, DriverPromptOptions, DriverSession, DriverStartOptions, DriverTurn, DriverUsage } from './types.js'

/**
 * Codex's sandbox policy for the shell commands the model writes.
 * `workspace-write` is our default: the agent can edit the workspace it was
 * pointed at, but not the rest of the machine. It is the counterpart of Claude
 * Code's `acceptEdits`, and the reason we never pass Codex's
 * `--dangerously-bypass-approvals-and-sandbox`.
 */
export type CodexSandbox = 'read-only' | 'workspace-write' | 'danger-full-access'

/** Options for {@link CodexDriver}. */
export interface CodexDriverOptions {
  /** CLI binary to spawn. Default `"codex"` (resolved on `PATH`). */
  bin?: string
  /** Sandbox policy. Default `"workspace-write"`. */
  sandbox?: CodexSandbox
  /**
   * Extra CLI args appended verbatim (escape hatch). Appended last, so a
   * `-c sandbox_workspace_write.writable_roots=...` here replaces the git dir
   * the driver makes writable rather than adding to it.
   */
  extraArgs?: string[]
  /** Environment for the child process. Default `process.env`. */
  env?: NodeJS.ProcessEnv
  /** `spawn` override for tests. Default `node:child_process.spawn`. */
  spawn?: SpawnLike
}

/**
 * The second real {@link Driver} (#539): wraps the **Codex CLI** in its
 * non-interactive mode (`codex exec --json`), on the user's own ChatGPT
 * subscription — no API key (#495's "bring your own subscription").
 *
 * The seam always said "Claude Code today, Codex later", and this is that. Same
 * black box: prompt it, let its own loop run, read the code it wrote.
 *
 * Three ways it differs from Claude Code, all of them the agent's business
 * rather than ours:
 *
 * - **No system-prompt flag.** Codex has no `--append-system-prompt`, so the
 *   framing is prepended to the prompt instead. Same words reach the agent.
 * - **Tokens, no price.** Codex reports token counts but never a price, so usage
 *   carries the counts and omits `costUsd` rather than claim a turn cost `$0`,
 *   which would read as free (#540).
 * - **No quota read.** No `readQuota`, for the same reason: the seam is optional
 *   precisely so an agent that can't report one simply doesn't.
 */
export class CodexDriver implements Driver {
  readonly id = 'codex'
  constructor(private readonly opts: CodexDriverOptions = {}) {}

  start(opts: DriverStartOptions): Promise<DriverSession> {
    return Promise.resolve(new CodexSession(this.opts, opts))
  }
}

let sessionCounter = 0

/**
 * One workspace-bound Codex session. Every `prompt` is its own CLI invocation: a fresh
 * conversation (`codex exec`), or, for a `resume` prompt, the session's conversation continued
 * (`codex exec resume <id>`).
 */
export class CodexSession implements DriverSession {
  readonly id: string
  readonly cwd: string
  readonly log?: SessionLog
  private readonly startOpts: DriverStartOptions
  /**
   * The conversation a `resume` prompt continues: the one the session was started to resume,
   * then the one the last turn reported. Codex keeps the id across a resume, so consecutive
   * messages chain.
   */
  private lastSessionId: string | undefined

  constructor(
    private readonly config: CodexDriverOptions,
    startOpts: DriverStartOptions,
  ) {
    const attached = attachLog(startOpts)
    this.startOpts = attached.opts
    if (attached.log) this.log = attached.log
    this.cwd = startOpts.cwd
    this.id = `codex-${++sessionCounter}`
    this.lastSessionId = startOpts.resumeSessionId
  }

  async prompt(text: string, opts: DriverPromptOptions = {}): Promise<DriverTurn> {
    // Codex takes no system-prompt flag, so the framing rides in front of the
    // prompt. Blank-line separated, so it reads as its own block.
    // A resumed conversation already carries its framing; sending it again only repeats it.
    const resumeId = opts.resume ? this.lastSessionId : undefined
    const framing = resumeId === undefined ? combineFraming(this.startOpts.system, opts.system) : ''
    const prompt = framing ? `${framing}\n\n${text}` : text
    // Resolved every turn, not at start: the agent may `git init` in turn 1.
    const gitDir = await gitCommonDir(this.cwd)
    const emit = makeEmit(this.startOpts.onEvent, 'codex')
    const turn = await runCliSession({
      bin: this.config.bin ?? 'codex',
      args: this.buildArgs(gitDir, resumeId),
      cwd: this.cwd,
      env: this.config.env ?? process.env,
      prompt,
      spawn: this.config.spawn ?? (nodeSpawn as unknown as SpawnLike),
      emit,
      signals: combineSignals(this.startOpts.signal, opts.signal),
      parser: new CodexJsonParser(),
      driver: 'codex',
    })
    if (turn.sessionId) this.lastSessionId = turn.sessionId
    return finishTurn(this, turn, opts, emit)
  }

  readCode(path: string): Promise<string> {
    return readWorkspaceFile(this.cwd, path)
  }

  dispose(): Promise<void> {
    // Each prompt spawns and reaps its own process; nothing durable to free.
    return Promise.resolve()
  }

  private buildArgs(gitDir: string | undefined, resumeId?: string): string[] {
    // No prompt argument: it goes over stdin, so a long one never hits the
    // arg-length limit. `--skip-git-repo-check` because Codex otherwise refuses
    // to run outside a git repo, and a workspace may legitimately not be one yet.
    const sandbox = this.config.sandbox ?? 'workspace-write'
    // `exec resume` takes neither `--sandbox` nor `-C` (codex-cli 0.144.4): the sandbox goes in
    // as the config value the flag sets, the directory is the process's own, and `-` is the
    // prompt read from stdin, which the id before it would otherwise be taken for.
    const args = resumeId
      ? ['exec', 'resume', resumeId, '-', '--json', '--skip-git-repo-check', '-c', `sandbox_mode=${JSON.stringify(sandbox)}`]
      : ['exec', '--json', '--skip-git-repo-check', '--sandbox', sandbox, '-C', this.cwd]
    // `workspace-write` keeps a `.git/` directory at the workspace root read-only,
    // so in a plain checkout (not a worktree) the agent's commit fails on
    // `.git/index.lock` (verified on codex-cli 0.144.4, #1747). The git dir is made
    // writable: committing is the agent's job, and a worktree's git dir already is.
    // The `-c` value is TOML; a JSON string array is a valid TOML array.
    if (sandbox === 'workspace-write' && gitDir) args.push('-c', `sandbox_workspace_write.writable_roots=${JSON.stringify([gitDir])}`)
    if (this.startOpts.model) args.push('-m', this.startOpts.model)
    if (this.config.extraArgs) args.push(...this.config.extraArgs)
    return args
  }
}

/** The absolute git common dir of `cwd`, or `undefined` when it is not a repository or git is missing. */
function gitCommonDir(cwd: string): Promise<string | undefined> {
  return new Promise(resolve => {
    execFile('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd }, (err, stdout) => {
      const dir = String(stdout).trim()
      resolve(err || !dir ? undefined : dir)
    })
  })
}

/**
 * Parses Codex's `exec --json` output: one JSON event per line.
 *
 * The dialect, as observed on codex-cli 0.144.4:
 * ```
 * {"type":"thread.started","thread_id":"019f..."}
 * {"type":"turn.started"}
 * {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
 * {"type":"item.started","item":{"type":"file_change","status":"in_progress"}}
 * {"type":"turn.completed","usage":{"input_tokens":12210,"output_tokens":5}}
 * ```
 */
export class CodexJsonParser implements AgentCliParser {
  private text = ''
  private sessionId: string | undefined
  private usage: DriverUsage | undefined

  push(line: string): DriverEvent[] {
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line) as Record<string, unknown>
    } catch {
      return [] // Banners and other noise: not every line is an event.
    }
    // `null` parses, so the catch above lets it through and every field read below throws — from
    // inside a readline handler, where nothing catches it. Noise is noise whatever it parses to.
    if (typeof obj !== 'object' || obj === null) return []
    const type = obj['type']

    // Announced at once, like Claude Code's: a turn that is stopped or fails before its result
    // must not take the id, the handle a later `exec resume` needs, with it.
    if (type === 'thread.started') {
      const id = obj['thread_id']
      if (typeof id !== 'string') return []
      this.sessionId = id
      return [{ type: 'session', sessionId: id }]
    }

    if (type === 'turn.completed') {
      const usage = parseCodexUsage(obj['usage'])
      if (usage) this.usage = usage
      return []
    }

    const item = obj['item']
    if (typeof item !== 'object' || item === null) return []
    const itemObj = item as Record<string, unknown>
    const itemType = itemObj['type']

    if (itemType === 'agent_message' && type === 'item.completed') {
      const text = itemObj['text']
      if (typeof text !== 'string') return []
      // Codex narrates in several messages; the last is its answer, and the
      // rest are progress. Keep the last as the turn, stream them all.
      this.text = text
      return [{ type: 'text', text }]
    }

    // Any other item is the agent using a tool. We surface the kind only, never
    // the arguments: the seam is the code and the outcome, not the tool calls.
    if (type === 'item.started' && typeof itemType === 'string') {
      return [{ type: 'action', label: itemType }]
    }
    return []
  }

  result(): DriverTurn {
    // Tokens but no `costUsd`: Codex prices nothing, and a `$0` would read as free
    // rather than as "we don't know" (#540).
    return {
      text: this.text,
      ...(this.sessionId ? { sessionId: this.sessionId } : {}),
      ...(this.usage ? { usage: this.usage } : {}),
    }
  }
}

/**
 * Map Codex's `turn.completed` usage onto {@link DriverUsage}. The dialect is
 * OpenAI's Responses API shape, flattened:
 * `{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens}`.
 *
 * Two things that shape the mapping, both verified against codex-cli 0.144.4:
 *
 * - `input_tokens` is the **total** input, cached included. Repeating one prompt
 *   held it at 12218 while `cached_input_tokens` rose 9984 -> 12032; a non-cached
 *   count would have fallen. So the uncached part is the difference, which is what
 *   `inputTokens` means here.
 * - `reasoning_output_tokens` is a **subset** of `output_tokens` (as
 *   `cached_input_tokens` is of `input_tokens`), so adding it would double-count.
 *
 * No price, and no cache-*write* count: OpenAI caches implicitly and bills no
 * separate write, so `cacheCreationTokens` is honestly 0 rather than a guess.
 */
export function parseCodexUsage(raw: unknown): DriverUsage | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const usage = raw as Record<string, unknown>
  const num = (key: string): number => {
    const value = usage[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
  }
  const input = num('input_tokens')
  const cached = Math.min(num('cached_input_tokens'), input)
  return {
    inputTokens: input - cached,
    outputTokens: num('output_tokens'),
    cacheReadTokens: cached,
    cacheCreationTokens: 0,
  }
}
