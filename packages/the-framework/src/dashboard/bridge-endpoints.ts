import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * The browser bridge (#1237): the one endpoint an extension running in the user's own Claude
 * session posts to, so a question a cloud run is parked on becomes visible in the dashboard.
 *
 * **Why this route carries its own token, unlike every other one.** The #1051 guard in
 * `startDashboard` only exists on a non-loopback bind, and what protects a loopback daemon is
 * the same-origin check on `/_telefunc`: a page on another origin is refused outright. This
 * route is the first that is *meant* to be reached from another origin, so neither of those
 * protects it, and it demands `Authorization: Bearer <daemonToken>` unconditionally instead.
 *
 * **No CORS headers, on purpose.** An extension's service worker holding `host_permissions`
 * fetches without a preflight, so the bridge does not need `Access-Control-Allow-Origin` and
 * must not have it: a wildcard here would let any page the user visits post to their daemon.
 * The cost is that the extension has to post from its background worker rather than from the
 * content script, which is a line in the extension and a much better trade.
 *
 * **What it accepts is deliberately tiny.** One shape, fully validated, with no path, command,
 * prompt or free text anywhere in it. The worst a stolen token buys is a bogus question card in
 * someone's dashboard, which is the point: this is attached to a daemon that spawns processes.
 */
export const BRIDGE_PREFIX = '/_bridge'

/** A question a cloud session is parked on, as reported by the bridge. */
export interface BridgeQuestion {
  /** The cloud session that asked, which joins back to a run through `RunMeta.sessionId`. */
  sessionId: string
  title: string
  options: { label: string; detail?: string }[]
  recommended?: string
  /** When the daemon accepted it. Set here, never by the caller. */
  receivedAt: string
}

/** What the daemon wires behind the bridge. Absent when the feature is off, which 404s it. */
export interface BridgeHandlers {
  /** The shared secret every bridge call must present. */
  token: string
  record: (question: BridgeQuestion) => void
  now?: () => Date
}

const MAX_BODY = 64 * 1024
const SESSION_ID = /^session_[A-Za-z0-9]{1,128}$/
const MAX_TITLE = 500
const MAX_LABEL = 300
const MAX_DETAIL = 500
const MAX_OPTIONS = 20

/** Route a `/_bridge/*` request. A daemon with the bridge off 404s every route. */
export async function handleBridgeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  handlers: BridgeHandlers | undefined,
): Promise<void> {
  if (!handlers) return end(res, 404, 'bridge not enabled')
  if (!authorized(req, handlers.token)) return end(res, 401, 'unauthorized')
  if (pathname === `${BRIDGE_PREFIX}/ping`) {
    if (req.method !== 'GET') return end(res, 405, 'method not allowed', { allow: 'GET' })
    return end(res, 200, 'ok')
  }
  if (pathname === `${BRIDGE_PREFIX}/question`) return handleQuestion(req, res, handlers)
  end(res, 404, 'not found')
}

/**
 * `Authorization: Bearer <token>`, compared in constant time. Rejects before the body is read,
 * so an unauthenticated caller cannot make the daemon buffer anything.
 */
function authorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(token)
  // timingSafeEqual throws on a length mismatch, which would itself leak the length.
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

/** `POST /_bridge/question`: validate hard, record, answer 204. */
async function handleQuestion(req: IncomingMessage, res: ServerResponse, handlers: BridgeHandlers): Promise<void> {
  if (req.method !== 'POST') return end(res, 405, 'method not allowed', { allow: 'POST' })
  let body: unknown
  try {
    body = await readJsonBody(req, MAX_BODY)
  } catch (err) {
    return end(res, 400, (err as Error).message)
  }
  const question = validate(body, (handlers.now ?? (() => new Date()))())
  if (typeof question === 'string') return end(res, 400, question)
  handlers.record(question)
  end(res, 204, '')
}

/**
 * Every field checked, with a reason on rejection. Unknown keys are dropped rather than
 * refused, so a newer extension posting an extra field still works against an older daemon.
 */
function validate(body: unknown, now: Date): BridgeQuestion | string {
  if (typeof body !== 'object' || body === null) return 'body must be an object'
  const raw = body as Record<string, unknown>
  const sessionId = raw.sessionId
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return 'sessionId must look like session_<id>'
  const title = raw.title
  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE) return `title must be a string of 1 to ${MAX_TITLE} characters`
  if (!Array.isArray(raw.options) || raw.options.length === 0) return 'options must be a non-empty array'
  if (raw.options.length > MAX_OPTIONS) return `options must hold at most ${MAX_OPTIONS} entries`
  const options: { label: string; detail?: string }[] = []
  for (const entry of raw.options) {
    if (typeof entry !== 'object' || entry === null) return 'each option must be an object'
    const { label, detail } = entry as Record<string, unknown>
    if (typeof label !== 'string' || !label.trim() || label.length > MAX_LABEL) return `each option needs a label of 1 to ${MAX_LABEL} characters`
    if (detail !== undefined && (typeof detail !== 'string' || detail.length > MAX_DETAIL)) return `an option detail must be a string of at most ${MAX_DETAIL} characters`
    options.push({ label, ...(typeof detail === 'string' && detail ? { detail } : {}) })
  }
  const recommended = raw.recommended
  if (recommended !== undefined && (typeof recommended !== 'string' || recommended.length > MAX_LABEL)) {
    return 'recommended must be a string naming one of the option labels'
  }
  // A recommendation that names no option would render a default the user cannot see.
  if (typeof recommended === 'string' && recommended && !options.some(o => o.label === recommended)) {
    return 'recommended must match one of the option labels'
  }
  return {
    sessionId,
    title,
    options,
    ...(typeof recommended === 'string' && recommended ? { recommended } : {}),
    receivedAt: now.toISOString(),
  }
}

/** Read a JSON body, refusing anything past the cap rather than buffering it. */
function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('body must be JSON'))
      }
    })
    req.on('error', () => reject(new Error('read failed')))
  })
}

function end(res: ServerResponse, status: number, message: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'text/plain', ...headers })
  res.end(message)
}
