import { spawn as nodeSpawn } from 'node:child_process'
import type { DriverModel, SpawnLike } from 'agent-driver'

/** How long {@link readClaudeModels} waits for the CLI's answer. */
export const MODELS_TIMEOUT_MS = 30_000

/** The request that asks the CLI for its session setup, the model list among it. */
const INITIALIZE = { type: 'control_request', request_id: 'models', request: { subtype: 'initialize' } }

/** Options for {@link readClaudeModels}. */
export interface ReadClaudeModelsOptions {
  /** CLI binary to spawn. Default `"claude"` (resolved on `PATH`). */
  bin?: string
  /** Extra CLI args, such as the switches that keep the person's own settings out. */
  extraArgs?: string[]
  /** Environment for the child process. Default `process.env`. */
  env?: NodeJS.ProcessEnv
  /** `spawn` override for tests. Default `node:child_process.spawn`. */
  spawn?: SpawnLike
  /** Abort the read. */
  signal?: AbortSignal
  /** Override the timeout. Default {@link MODELS_TIMEOUT_MS}. */
  timeoutMs?: number
}

/**
 * Ask Claude Code which models it offers: the list its own `/model` picker shows, for the person's
 * login. The CLI is started in its stream-json mode and sent only its `initialize` control request,
 * whose answer carries the list; no prompt is sent, so no model runs. The CLI is stopped once it
 * has answered.
 */
export function readClaudeModels(opts: ReadClaudeModelsOptions = {}): Promise<DriverModel[]> {
  return new Promise<DriverModel[]>((resolvePromise, rejectPromise) => {
    if (opts.signal?.aborted) {
      rejectPromise(new Error('Claude Code was not asked for its models: the read was stopped'))
      return
    }
    const spawn = opts.spawn ?? (nodeSpawn as unknown as SpawnLike)
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', ...(opts.extraArgs ?? [])]
    const child = spawn(opts.bin ?? 'claude', args, { cwd: process.cwd(), env: opts.env ?? process.env })

    let settled = false
    const settle = (answer: { models: DriverModel[] } | { error: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      child.kill('SIGTERM')
      if ('models' in answer) resolvePromise(answer.models)
      else rejectPromise(new Error(answer.error))
    }
    const onAbort = () => settle({ error: 'Claude Code was not asked for its models: the read was stopped' })
    opts.signal?.addEventListener('abort', onAbort)
    // Not unref'd: it is what guarantees the promise settles.
    const timer = setTimeout(() => settle({ error: `Claude Code did not list its models within ${Math.round((opts.timeoutMs ?? MODELS_TIMEOUT_MS) / 1000)}s` }), opts.timeoutMs ?? MODELS_TIMEOUT_MS)

    let pending = ''
    child.stdout?.on('data', (chunk: Buffer | string) => {
      pending += String(chunk)
      let newline: number
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline)
        pending = pending.slice(newline + 1)
        const answer = parseInitializeLine(line)
        if (answer) settle(answer)
      }
    })
    child.on('error', err => settle({ error: `\`${opts.bin ?? 'claude'}\` could not start: ${err.message}` }))
    child.on('close', code => settle({ error: `Claude Code exited (code ${code}) before it listed its models` }))
    child.stdin?.write(`${JSON.stringify(INITIALIZE)}\n`)
  })
}

/**
 * Read one line of the CLI's output: the models when it is the answer to the `initialize` request,
 * the CLI's own error when that request failed, `undefined` for any other line.
 *
 * The CLI's first entry, `default`, is not a model: it is "no pick", which a caller already has by
 * passing no model. It is left out, so every entry names one model.
 */
export function parseInitializeLine(line: string): { models: DriverModel[] } | { error: string } | undefined {
  let message: unknown
  try {
    message = JSON.parse(line)
  } catch {
    return undefined
  }
  const outer = record(message)
  if (outer?.['type'] !== 'control_response') return undefined
  const response = record(outer['response'])
  if (response?.['request_id'] !== INITIALIZE.request_id) return undefined
  if (response['subtype'] === 'error') return { error: `Claude Code could not list its models: ${String(response['error'] ?? 'no reason given')}` }
  const listed = record(response['response'])?.['models']
  if (!Array.isArray(listed)) return { error: 'Claude Code answered without a model list' }
  const models: DriverModel[] = []
  for (const entry of listed) {
    const model = record(entry)
    const id = model?.['value']
    const name = model?.['displayName']
    if (typeof id !== 'string' || typeof name !== 'string' || id === 'default') continue
    models.push({ id, name })
  }
  return { models }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}
