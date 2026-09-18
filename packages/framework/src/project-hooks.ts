import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { errorMessage } from './error-message.js'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'

/**
 * A project's hooks (#1774): the shell lines a project's own `.the-framework/hooks.yml` names to
 * run when the dashboard opens and when it closes, the two lines that start a run and continue
 * one, and the line that sets how far past the quota boundary unattended work may go. The daemon names no tool: it runs whatever the file says, in the project. Per
 * user, since `.the-framework/` is ignored: a hook is this machine's, and a teammate's pull
 * changes nothing.
 *
 * Optional, best-effort and bounded: no file means nothing runs, a broken file is a warning, an
 * `open` or `close` line that fails or hangs is logged and the next line still runs, and nothing
 * here ever throws to the daemon.
 */

/** The hooks file, under the project's ignored `.the-framework/`. */
export const PROJECT_HOOKS_FILE = `${THE_FRAMEWORK_DIR}/hooks.yml`

/** How long one line may run before it is killed and logged as timed out. */
export const HOOK_TIMEOUT_MS = 60_000

/** When a project's hooks run: `open` when the dashboard starts (and when the project is added while it runs), `close` when it stops. */
export type HookKind = 'open' | 'close'

/**
 * The two lines a person's click runs to start or continue a run: `start` begins a run from a
 * prompt, `resume` continues an ended one with a text or an answer. One line each, since each
 * answers one document on stdout.
 */
export type RunHookKind = 'start' | 'resume'

/**
 * The lines a person's click runs, one shell line each: the two run lines, and `offset`, which
 * sets how far past the quota boundary the project's unattended work may go.
 */
type OneLineHookKind = RunHookKind | 'offset'

export interface ProjectHooks {
  open: string[]
  close: string[]
  start?: string
  resume?: string
  offset?: string
}

const HOOK_KINDS: readonly HookKind[] = ['open', 'close']
const ONE_LINE_HOOK_KINDS: readonly OneLineHookKind[] = ['start', 'resume', 'offset']

/**
 * Read a project's hooks. A missing file is no hooks. A file that cannot be parsed or has the
 * wrong shape is reported through `onWarn`, prefixed "ignoring", and counts as no hooks.
 */
export async function readProjectHooks(cwd: string, onWarn?: (message: string) => void): Promise<ProjectHooks> {
  let raw: string
  try {
    raw = await readFile(join(cwd, PROJECT_HOOKS_FILE), 'utf8')
  } catch {
    return { open: [], close: [] }
  }
  try {
    return parseProjectHooks(raw)
  } catch (err) {
    onWarn?.(`ignoring ${errorMessage(err)}`)
    return { open: [], close: [] }
  }
}

/**
 * Parse the hooks file: a YAML map whose keys are `open` and `close`, each a list of shell lines,
 * and `start`, `resume` and `offset`, each one shell line. An empty document is no hooks. Anything else throws, so the reader can warn: a wrong key is
 * refused rather than ignored, because a misspelled `open` would otherwise be a hook that
 * silently never runs.
 */
export function parseProjectHooks(raw: string, source = PROJECT_HOOKS_FILE): ProjectHooks {
  let data: unknown
  try {
    data = parseYaml(raw)
  } catch (err) {
    // The parser's message runs to several lines with a caret drawing; the first line says what is wrong.
    throw new Error(`${source}: ${errorMessage(err).split('\n')[0]}`)
  }
  const hooks: ProjectHooks = { open: [], close: [] }
  if (data == null) return hooks
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error(`${source} must be a YAML map; the keys are open, close, start, resume and offset`)
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isOneLine = (ONE_LINE_HOOK_KINDS as readonly string[]).includes(key)
    if (!isOneLine && !(HOOK_KINDS as readonly string[]).includes(key)) throw new Error(`${source}: unknown key "${key}"; the keys are open, close, start, resume and offset`)
    if (value == null) continue
    if (isOneLine) {
      if (typeof value !== 'string' || value.trim() === '') throw new Error(`${source}: "${key}" must be one shell line`)
      hooks[key as OneLineHookKind] = value.trim()
      continue
    }
    if (!Array.isArray(value) || !value.every(line => typeof line === 'string' && line.trim() !== '')) {
      throw new Error(`${source}: "${key}" must be a list of shell lines`)
    }
    hooks[key as HookKind] = value.map(line => line.trim())
  }
  return hooks
}

export interface RunHooksOptions {
  /** Where each line's outcome and the tool's stderr go; default nowhere. */
  log?: (line: string) => void
  /** How long one line may run; default {@link HOOK_TIMEOUT_MS}. */
  timeoutMs?: number
  /** The environment the lines run with; default the daemon's own. */
  env?: NodeJS.ProcessEnv
}

/**
 * Run a project's `open` or `close` lines, in order, each through `sh -c` with the project's
 * root as working directory. A line that exits non-zero, times out or cannot start is logged and
 * the next line still runs; the lines' stderr is logged too, since a tool's one line for a person
 * goes there. Never throws.
 */
export async function runProjectHooks(cwd: string, kind: HookKind, opts: RunHooksOptions = {}): Promise<void> {
  const log = opts.log ?? (() => {})
  const hooks = await readProjectHooks(cwd, message => log(`[framework] ${kind} hook (${basename(cwd)}): ${message}`))
  for (const line of hooks[kind]) {
    const outcome = await runLine(cwd, line, opts.timeoutMs ?? HOOK_TIMEOUT_MS, opts.env ?? process.env)
    log(`[framework] ${kind} hook (${basename(cwd)}): ${line}: ${outcome.summary}`)
    for (const said of outcome.stderr.split('\n').map(s => s.trimEnd()).filter(Boolean)) log(`[framework]   ${said}`)
  }
}

/** What a `start` line is given: the prompt, and the coding agent and model when the person picked them. */
export interface StartHookInput {
  prompt: string
  driver?: string
  model?: string
}

/** What a `resume` line is given: the run, and the person's text or their answer to the question it ended on. */
export type ResumeHookInput = { runId: string } & ({ text: string } | { answer: string })

export type RunHookResult = { ok: true; id: string } | { ok: false; error: string }

/**
 * Run the project's `start` line: the prompt in `PROMPT`, the picks in `DRIVER` and `MODEL` when
 * made. The line answers one JSON document on stdout whose `id` names the run it started.
 */
export function runStartHook(cwd: string, input: StartHookInput, opts: Omit<RunHooksOptions, 'log'> = {}): Promise<RunHookResult> {
  return runRunHook(cwd, 'start', {
    PROMPT: input.prompt,
    ...(input.driver !== undefined ? { DRIVER: input.driver } : {}),
    ...(input.model !== undefined ? { MODEL: input.model } : {}),
  }, opts)
}

/**
 * Run the project's `resume` line: the run in `RUN_ID`, and the person's words in `TEXT` or their
 * answer in `ANSWER`. The line answers like a `start` line, naming the run it continued.
 */
export function runResumeHook(cwd: string, input: ResumeHookInput, opts: Omit<RunHooksOptions, 'log'> = {}): Promise<RunHookResult> {
  return runRunHook(cwd, 'resume', { RUN_ID: input.runId, ...('text' in input ? { TEXT: input.text } : { ANSWER: input.answer }) }, opts)
}

async function runRunHook(cwd: string, kind: RunHookKind, vars: Record<string, string>, opts: Omit<RunHooksOptions, 'log'>): Promise<RunHookResult> {
  let broken: string | undefined
  const hooks = await readProjectHooks(cwd, message => {
    broken = message
  })
  const line = hooks[kind]
  if (line === undefined) return { ok: false, error: broken ?? `this project has no ${kind} hook` }
  const outcome = await runLine(cwd, line, opts.timeoutMs ?? HOOK_TIMEOUT_MS, { ...(opts.env ?? process.env), ...vars }, true)
  let said: unknown
  try {
    said = JSON.parse(outcome.stdout)
  } catch {
    said = undefined
  }
  const id = said && typeof said === 'object' ? (said as Record<string, unknown>)['id'] : undefined
  if (outcome.summary === 'exit 0' && typeof id === 'string' && id !== '') return { ok: true, id }
  // The tool's one line for a person is its last on stderr; without one, how the line ended.
  const lastSaid = outcome.stderr.split('\n').map(s => s.trim()).filter(Boolean).at(-1)
  return { ok: false, error: `the ${kind} hook: ${lastSaid ?? (outcome.summary === 'exit 0' ? 'it answered no run id' : outcome.summary)}` }
}

/** How an `offset` line went; `noHook` when the project's file names no such line. */
export type OffsetHookResult = { ok: true } | { ok: false; error: string; noHook?: true }

/**
 * Run the project's `offset` line: the percentage points in `POINTS`, how far past the quota
 * boundary the project's unattended work may go. Exit 0 is done; the line answers nothing else.
 */
export async function runOffsetHook(cwd: string, points: number, opts: Omit<RunHooksOptions, 'log'> = {}): Promise<OffsetHookResult> {
  let broken: string | undefined
  const hooks = await readProjectHooks(cwd, message => {
    broken = message
  })
  if (hooks.offset === undefined) return broken ? { ok: false, error: broken } : { ok: false, error: 'this project has no offset hook', noHook: true }
  const outcome = await runLine(cwd, hooks.offset, opts.timeoutMs ?? HOOK_TIMEOUT_MS, { ...(opts.env ?? process.env), POINTS: String(points) })
  if (outcome.summary === 'exit 0') return { ok: true }
  const lastSaid = outcome.stderr.split('\n').map(s => s.trim()).filter(Boolean).at(-1)
  return { ok: false, error: `the offset hook: ${lastSaid ?? outcome.summary}` }
}

/** One line through the shell: how it ended, in words, what it said on stderr, and its stdout when asked for. */
function runLine(cwd: string, line: string, timeoutMs: number, env: NodeJS.ProcessEnv, readStdout = false): Promise<{ summary: string; stderr: string; stdout: string }> {
  return new Promise(resolve => {
    let stderr = ''
    let stdout = ''
    let settled = false
    const done = (summary: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ summary, stderr, stdout })
    }
    let child: ReturnType<typeof spawn>
    try {
      child = spawn('sh', ['-c', line], { cwd, env, stdio: ['ignore', readStdout ? 'pipe' : 'ignore', 'pipe'] })
    } catch (err) {
      done(`could not start: ${errorMessage(err)}`)
      return
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      done(`timed out after ${Math.round(timeoutMs / 1000)}s`)
    }, timeoutMs)
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.once('error', err => done(`could not start: ${errorMessage(err)}`))
    child.once('close', (code, signal) => done(signal ? `killed by ${signal}` : `exit ${code ?? 0}`))
  })
}
