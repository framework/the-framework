import { randomBytes } from 'node:crypto'
import { appendFile, mkdir, open, rm, stat, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname } from 'node:path'
import { activePage, connectCdp, listPages, type CdpSession, type PageTarget } from './cdp.js'
import { launchChrome, type Chrome } from './chrome.js'
import { click, navigate, PageError, press, readPage, run, screenshot, type } from './page.js'
import { framePart, inputCalls, SCREEN_HTML, stepHistory, type ScreenInput } from './screen.js'

/**
 * The browser's own process: started by the first `open`, it keeps Chrome, the page connection
 * and the screen, and takes the agent's commands over loopback HTTP. Every request carries the
 * token the state file holds (the command reads it) or the screen address holds (the person's
 * view); anything else is refused.
 *
 * It ends, closing Chrome, on the first of: `browser close`; the run it belongs to ending (an
 * `ended` line reaching the diary after it started); the diary's file going away (the run's
 * checkout reclaimed); no command and no input for `idleMs`; Chrome exiting.
 */

/** What the state file holds, for the command to find this process. */
export interface HostState {
  pid: number
  port: number
  token: string
}

export interface HostOptions {
  chromePath: string
  stateFile: string
  /** The run's diary, from `AGENT_DIARY`; absent outside a run, and then no screen line is written. */
  diary?: string
  idleMs: number
}

/** A command the agent sent, as the CLI forwards it. */
export interface HostCommand {
  name: 'open' | 'read' | 'click' | 'type' | 'press' | 'screenshot' | 'eval' | 'close'
  args: string[]
}

export type HostAnswer = { ok: true; output: string; png?: string } | { ok: false; reason: string }

/** The screen line a diary gets: where the live view is, and what it showed then. */
export interface ScreenLine {
  kind: 'screen'
  url: string
  label: string
  ended?: true
}

const BOUNDARY = 'frame'

/** How long a command may take before the agent is told the page did not answer. */
export const COMMAND_MS = 30_000

/** `work`, or a refusal once `ms` pass; the work itself goes on. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PageError(`the page did not answer within ${ms / 1000}s: read it again, or close the browser and open it again`)), ms)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

export async function runHost(opts: HostOptions): Promise<void> {
  const token = randomBytes(16).toString('hex')
  let chrome: Chrome
  try {
    chrome = await launchChrome(opts.chromePath)
  } catch (err) {
    await writeState(opts.stateFile, { error: err instanceof Error ? err.message : String(err) })
    return
  }

  let page: CdpSession | undefined
  let pageId: string | undefined
  let latest: Buffer | undefined
  const viewers = new Set<ServerResponse>()
  let lastUse = Date.now()
  let screenUrl = ''
  let screenShown = false

  /** Dialogs the page opened since the last command answered, each accepted as it opened. */
  let dialogs: string[] = []
  /** The last attach, so two callers never attach to a new tab at once. */
  let attaching: Promise<CdpSession> | undefined

  /** The page the agent is on, connected, with the screencast running on it. Follows a new tab. */
  const current = (): Promise<CdpSession> => {
    const run = (attaching ?? Promise.resolve(undefined)).catch(() => undefined).then(() => attach())
    attaching = run
    return run
  }
  const attach = async (): Promise<CdpSession> => {
    const target: PageTarget | undefined = activePage(await listPages(chrome.endpoint).catch(() => []))
    if (!target) throw new PageError('the browser has no page open')
    if (page?.open && target.id === pageId) return page
    const next = await connectCdp(target.webSocketDebuggerUrl!)
    next.on('Page.screencastFrame', params => {
      latest = Buffer.from(String(params['data']), 'base64')
      for (const res of viewers) res.write(framePart(BOUNDARY, latest))
      void next.send('Page.screencastFrameAck', { sessionId: params['sessionId'] }).catch(() => {})
    })
    // A dialog blocks the page until answered: every one is accepted at once, and the next
    // answer to the agent names it.
    next.on('Page.javascriptDialogOpening', params => {
      dialogs.push(`${String(params['type'])} ${JSON.stringify(String(params['message'] ?? ''))}`)
      void next.send('Page.handleJavaScriptDialog', { accept: true, ...(params['type'] === 'prompt' ? { promptText: String(params['defaultPrompt'] ?? '') } : {}) }).catch(() => {})
    })
    await next.send('Page.enable')
    await next.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 1280, maxHeight: 800 })
    const previous = page
    page = next
    pageId = target.id
    previous?.close()
    return next
  }
  try {
    await current()
  } catch (err) {
    await chrome.close()
    await writeState(opts.stateFile, { error: err instanceof Error ? err.message : String(err) })
    return
  }

  const writeScreen = async (line: ScreenLine): Promise<void> => {
    if (!opts.diary) return
    await appendFile(opts.diary, JSON.stringify(line) + '\n').catch(() => {})
  }

  /** The command before, so the next one starts once it has answered. */
  let queue: Promise<unknown> = Promise.resolve()

  let ending: Promise<void> | undefined
  const end = (): Promise<void> =>
    (ending ??= (async () => {
      clearInterval(timer)
      clearInterval(repeat)
      for (const res of viewers) res.end()
      page?.close()
      const closed = new Promise<void>(resolve => server.close(() => resolve()))
      server.closeAllConnections()
      await closed
      if (screenShown && !runEnded) await writeScreen({ kind: 'screen', url: screenUrl, label: 'browser · closed', ended: true })
      await chrome.close()
      await rm(opts.stateFile, { force: true })
    })())

  const command = async (cmd: HostCommand): Promise<HostAnswer> => {
    const [first = '', second = ''] = cmd.args
    const ref = (): number => {
      const n = Number(first)
      if (!Number.isInteger(n) || n < 1) throw new PageError(`${first || '(nothing)'} is not an element number: use the number in brackets from the last read`)
      return n
    }
    const p = await current()
    switch (cmd.name) {
      case 'open': {
        await navigate(p, first)
        const output = await readPage(p)
        // The chat gets a screen here, where the agent used the browser.
        const url = /^URL: (.*)$/m.exec(output)?.[1] ?? first
        await writeScreen({ kind: 'screen', url: screenUrl, label: `browser · ${url}` })
        screenShown = true
        return { ok: true, output }
      }
      case 'read':
        return { ok: true, output: await readPage(p) }
      case 'click':
        await click(p, ref())
        return { ok: true, output: await readPage(await current()) }
      case 'type':
        await type(p, ref(), second)
        return { ok: true, output: await readPage(await current()) }
      case 'press':
        await press(p, first)
        return { ok: true, output: await readPage(await current()) }
      case 'screenshot':
        return { ok: true, output: '', png: (await screenshot(p)).toString('base64') }
      case 'eval':
        return { ok: true, output: await run(p, first) }
      case 'close':
        setImmediate(() => void end())
        return { ok: true, output: 'The browser is closed.' }
    }
  }

  const server = createServer((req, res) => {
    void serve(req, res).catch(err => {
      if (!res.headersSent) res.writeHead(500).end(err instanceof Error ? err.message : String(err))
    })
  })

  const serve = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if ((url.searchParams.get('t') ?? req.headers['x-browser-token']) !== token) return void res.writeHead(403).end()
    if (req.method === 'GET' && url.pathname === '/') {
      return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(SCREEN_HTML)
    }
    if (req.method === 'GET' && url.pathname === '/stream') {
      res.writeHead(200, { 'content-type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`, 'cache-control': 'no-store', connection: 'close' })
      res.flushHeaders()
      if (latest) res.write(framePart(BOUNDARY, latest))
      viewers.add(res)
      req.on('close', () => viewers.delete(res))
      return
    }
    if (req.method === 'GET' && url.pathname === '/state') {
      const target = activePage(await listPages(chrome.endpoint).catch(() => []))
      return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ url: target?.url ?? '', title: target?.title ?? '' }))
    }
    if (req.method !== 'POST') return void res.writeHead(404).end()
    const body = await readBody(req)
    lastUse = Date.now()
    if (url.pathname === '/input') {
      const input = body as ScreenInput
      const p = await current()
      if (input?.type === 'back' || input?.type === 'forward') {
        await stepHistory(p, input.type === 'back' ? -1 : 1)
        return void res.writeHead(204).end()
      }
      const calls = inputCalls(input)
      for (const call of calls) await p.send(call.method, call.params).catch(() => {})
      return void res.writeHead(calls.length ? 204 : 400).end()
    }
    if (url.pathname === '/command') {
      let answer: HostAnswer
      try {
        // One command at a time: two at once on one page would cancel each other's loads. The
        // next waits for this one's answer, which comes within COMMAND_MS whatever the page does.
        const turn = queue.then(() => withTimeout(command(body as HostCommand), COMMAND_MS))
        queue = turn.catch(() => {})
        answer = await turn
      } catch (err) {
        answer = { ok: false, reason: err instanceof Error ? err.message : String(err) }
      }
      if (dialogs.length) {
        const named = dialogs.map(d => `Dialog, accepted: ${d}`)
        answer = answer.ok ? { ...answer, output: [...named, '', answer.output].join('\n') } : { ok: false, reason: [...named, answer.reason].join('\n') }
      }
      dialogs = []
      return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer))
    }
    res.writeHead(404).end()
  }

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  screenUrl = `http://127.0.0.1:${port}/?t=${token}`

  // A still page sends no frames, and a multipart image paints a frame only once the next part
  // begins: the newest frame is sent again every second while someone watches.
  const repeat = setInterval(() => {
    if (latest) for (const res of viewers) res.write(framePart(BOUNDARY, latest))
  }, 1000)

  // Where the run's diary stood when this started: an `ended` line after it is this run ending.
  let diaryOffset = opts.diary ? (await stat(opts.diary).catch(() => undefined))?.size ?? 0 : 0
  let runEnded = false
  const timer = setInterval(() => {
    void (async () => {
      if (Date.now() - lastUse > opts.idleMs) return end()
      if (opts.diary) {
        const fresh = await readFrom(opts.diary, diaryOffset)
        if (fresh === undefined) {
          runEnded = true
          return end()
        }
        diaryOffset += fresh.length
        if (/"kind":"ended"/.test(fresh.toString('utf8'))) {
          runEnded = true
          return end()
        }
      }
    })()
  }, 2000)

  chrome.process.once('exit', () => void end())
  process.once('SIGTERM', () => void end())
  process.once('SIGINT', () => void end())

  await writeState(opts.stateFile, { pid: process.pid, port, token } satisfies HostState)
  await new Promise<void>(resolve => server.once('close', () => resolve()))
  await ending
}

/** The file's bytes from `offset` on, or `undefined` when the file is gone. */
async function readFrom(path: string, offset: number): Promise<Buffer | undefined> {
  const handle = await open(path, 'r').catch(() => undefined)
  if (!handle) return undefined
  try {
    const { size } = await handle.stat()
    if (size <= offset) return Buffer.alloc(0)
    const buffer = Buffer.alloc(size - offset)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('request too large')
  }
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

async function writeState(file: string, state: HostState | { error: string }): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  await writeFile(file, JSON.stringify(state), { mode: 0o600 })
}
