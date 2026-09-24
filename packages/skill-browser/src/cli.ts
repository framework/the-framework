import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveChromePath } from './chrome.js'
import type { HostAnswer, HostCommand, HostState } from './host.js'

/**
 * The `browser` command. Each call is short: it finds the browser's own process for this project
 * (the state file under the temp directory, keyed by the project's root), starting it on `open`
 * when there is none, and forwards the command to it. The page comes back as text on stdout.
 *
 * Exit codes: 0 done, 1 a refusal (the sentence on stderr), 2 a command line that could not be read.
 */

export const USAGE = `usage: browser <command>

  open <address>          open the address, starting the browser if none is open, and print the page
  read                    print the page: its text, then its numbered elements
  click <n>               click element n of the last read, then print the page
  type <n> <text>         replace what element n holds with the text (a select: pick that option),
                          then print the page
  press <key>             press Enter, Tab, Escape, Backspace, Space, ArrowUp, ArrowDown, ArrowLeft
                          or ArrowRight, then print the page
  screenshot [file]       save what the page shows as a PNG, and print the file's path
  eval <script>           run JavaScript in the page and print what it returns, as JSON
  close                   close the browser

Exit code 1 for a refusal (the reason on stderr), 2 for a usage error.`

export interface CliIo {
  cwd: string
  env: NodeJS.ProcessEnv
  stdout: (line: string) => void
  stderr: (line: string) => void
}

/** How long a browser sits unused before it closes itself. */
export const IDLE_MS = 30 * 60 * 1000

/** How many arguments each command takes: [least, most]. */
const ARITY: Record<HostCommand['name'], [number, number]> = {
  open: [1, 1],
  read: [0, 0],
  click: [1, 1],
  type: [2, 2],
  press: [1, 1],
  screenshot: [0, 1],
  eval: [1, 1],
  close: [0, 0],
}

/** The project a browser belongs to: the git root of the working directory, else the directory itself. */
export function projectRoot(cwd: string): string {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  return git.status === 0 ? git.stdout.trim() : resolve(cwd)
}

/** Where the browser's process of a project writes how to reach it. */
export function stateFile(root: string): string {
  return join(tmpdir(), 'skill-browser', `${createHash('sha256').update(root).digest('hex').slice(0, 16)}.json`)
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const [name, ...args] = argv
  if (name === undefined || name === '--help' || name === '-h') {
    io.stdout(USAGE)
    return name === undefined ? 2 : 0
  }
  const arity = ARITY[name as HostCommand['name']]
  if (!arity || args.length < arity[0] || args.length > arity[1]) {
    io.stderr(USAGE)
    return 2
  }
  const refuse = (reason: string): number => {
    io.stderr(reason)
    return 1
  }

  const file = stateFile(projectRoot(io.cwd))
  let state = await liveState(file)
  if (!state) {
    if (name !== 'open') return refuse('No browser is open. Start one with `browser open <address>`.')
    const chromePath = resolveChromePath(io.env)
    if (!chromePath) return refuse('No Chrome on this machine: install Google Chrome, or set CHROME_PATH to a Chrome or Chromium executable.')
    const started = await startHost(file, chromePath, io.env)
    if ('error' in started) return refuse(`The browser could not start: ${started.error}`)
    state = started
  }

  const answer = await send(state, { name: name as HostCommand['name'], args })
  if (!answer.ok) return refuse(answer.reason)
  if (answer.png !== undefined) {
    const path = resolve(io.cwd, args[0] ?? join(tmpdir(), `browser-${Date.now()}.png`))
    await writeFile(path, Buffer.from(answer.png, 'base64'))
    io.stdout(path)
    return 0
  }
  io.stdout(answer.output)
  return 0
}

/** The state of a browser that answers, or `undefined` (a stale file is removed). */
async function liveState(file: string): Promise<HostState | undefined> {
  const state = await readState(file)
  if (!state || 'error' in state) return undefined
  const alive = await fetch(`http://127.0.0.1:${state.port}/state?t=${state.token}`).then(res => res.ok, () => false)
  if (alive) return state
  await rm(file, { force: true })
  return undefined
}

async function readState(file: string): Promise<HostState | { error: string } | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as HostState | { error: string }
  } catch {
    return undefined
  }
}

/** Start the browser's process, detached so it outlives this command, and wait for its state file. */
async function startHost(file: string, chromePath: string, env: NodeJS.ProcessEnv): Promise<HostState | { error: string }> {
  await rm(file, { force: true })
  const main = fileURLToPath(new URL('./host-main.js', import.meta.url))
  const child = spawn(process.execPath, [main, '--state', file, '--chrome', chromePath, '--idle-ms', String(IDLE_MS)], { detached: true, stdio: 'ignore', env })
  child.unref()
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const state = await readState(file)
    if (state) return state
    await new Promise(r => setTimeout(r, 100))
  }
  return { error: 'it did not answer within 30s' }
}

async function send(state: HostState, command: HostCommand): Promise<HostAnswer> {
  try {
    const res = await fetch(`http://127.0.0.1:${state.port}/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-browser-token': state.token },
      body: JSON.stringify(command),
    })
    return (await res.json()) as HostAnswer
  } catch (err) {
    return { ok: false, reason: `The browser stopped answering: ${err instanceof Error ? err.message : String(err)}` }
  }
}
