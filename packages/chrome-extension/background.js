// The half that talks to the daemon.
//
// **Why the fetch lives here and not in the content script.** A content script's fetch carries
// the page's origin, so it would be a cross-origin request and the daemon deliberately answers
// no CORS headers: a wildcard there would let any site the user visits post to their dashboard.
// A service worker holding `host_permissions` is not subject to CORS, so the same request works
// from here and only from here.
//
// It also keeps the token out of the page. A content script shares a tab with claude.ai, and
// nothing on that page should ever be able to read the secret that talks to a daemon.

importScripts('driver-plan.js')

const DEFAULT_DAEMON = 'http://localhost:4200'

// Every daemon call states this extension's version, and a daemon expecting another refuses it
// outright (#1519): a version-skewed extension half-works in ways that read as dashboard bugs,
// so the daemon blocks rather than degrades, and the error it answers names both versions.
const VERSION_HEADER = { 'x-tf-extension-version': chrome.runtime.getManifest().version }

/** What we last successfully reported per session, so a re-render does not re-post. */
const lastSent = new Map()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Run a cycle on demand, so the options page can prove it works without waiting on an alarm.
  if (message?.type === 'tf-open-now') {
    void openDriverNow()
      .then(sendResponse)
      .catch(err => sendResponse({ ok: false, reason: String(err?.message ?? err) }))
    return true
  }
  if (message?.type === 'tf-hello') {
    // The reply says whether the page asking is the Driver tab, so it draws its overlay the
    // moment it loads rather than when the first cycle reaches it.
    void Promise.all([post('/_bridge/hello', { version: message.version, sessionId: message.sessionId, note: message.note }), driverTabId()])
      .then(([reply, driver]) => sendResponse({ ...reply, driver: sender.tab?.id != null && sender.tab.id === driver }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === 'tf-driver-log') {
    // Receiving it is the point: a cycle in the page can run for minutes, and each message
    // resets the idle clock that would otherwise end this worker mid-cycle.
    sendResponse({ ok: true })
    return false
  }
  if (message?.type === 'tf-events') {
    void postEvents(message)
      .then(sendResponse)
      .catch(err => sendResponse({ ok: false, error: String(err?.message ?? err) }))
    return true
  }
  if (message?.type !== 'tf-question') return false
  void report(message.question)
    .then(sendResponse)
    .catch(err => sendResponse({ ok: false, error: String(err?.message ?? err) }))
  // Keep the message channel open for the async reply.
  return true
})

async function report(question) {
  if (!question?.sessionId) return { ok: false, error: 'no session id' }
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return { ok: false, error: 'no token set: open the extension options' }

  // Same question, same session: say so and spend nothing. The content script re-surveys on every
  // DOM change, and a parked question can sit there for an hour.
  const fingerprint = JSON.stringify([question.title, question.options, question.recommended])
  if (lastSent.get(question.sessionId) === fingerprint) return { ok: true, skipped: 'unchanged' }

  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  const res = await fetch(`${base}/_bridge/question`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...VERSION_HEADER },
    body: JSON.stringify(question),
  })
  if (!res.ok) {
    // Do not remember a failure, so the next DOM change retries rather than going quiet.
    return { ok: false, error: `daemon answered ${res.status}: ${(await res.text()).slice(0, 200)}` }
  }
  lastSent.set(question.sessionId, fingerprint)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Answers travelling back (#1237): the dashboard queues a pick, the cycle collects it, the Driver
// tab types it into the session, and the outcome is reported.

/** Answer ids already handed to the Driver, so a slow ack cannot double-submit into the session. */
const deliveredAnswers = new Set()

/** Acks that failed to reach the daemon, retried on the next cycle rather than dropped. */
const pendingAcks = new Map()

/** Tell the daemon what a delivery did. A failed ack is kept and retried, never dropped: an
 * unacked delivered answer would sit `queued` in the dashboard after being typed into the page. */
async function ack(base, token, body) {
  try {
    const res = await fetch(`${base}/_bridge/answered`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...VERSION_HEADER },
      body: JSON.stringify(body),
    })
    if (res.ok || res.status === 400) {
      pendingAcks.delete(body.id)
      return
    }
  } catch {
    // Fall through to the retry queue.
  }
  pendingAcks.set(body.id, body)
}

/** The answer the dashboard queued for that session, or undefined. */
async function fetchAnswer(base, token, sessionId) {
  try {
    const res = await fetch(`${base}/_bridge/answer?sessionId=${sessionId}`, {
      headers: { authorization: `Bearer ${token}`, ...VERSION_HEADER },
    })
    if (!res.ok) return undefined
    const answer = (await res.json())?.answer
    return answer?.id && typeof answer.text === 'string' ? answer : undefined
  } catch {
    return undefined
  }
}

/** The next session the daemon wants created, claimed by this read (#1328), or undefined. */
async function claimStart(base, token) {
  try {
    const res = await fetch(`${base}/_bridge/start`, { headers: { authorization: `Bearer ${token}`, ...VERSION_HEADER } })
    if (!res.ok) return undefined
    const start = (await res.json())?.start
    return start?.id && typeof start.repo === 'string' && typeof start.branch === 'string' && typeof start.prompt === 'string' ? start : undefined
  } catch {
    return undefined
  }
}

/** One authenticated POST to the daemon. */
async function post(path, body) {
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return { ok: false, error: 'no token set' }
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...VERSION_HEADER },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, error: `daemon answered ${res.status}: ${(await res.text()).slice(0, 200)}` }
  return { ok: true }
}

/** Send a batch of transcript entries. Same token and same discipline as the question. */
async function postEvents({ sessionId, events }) {
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return { ok: false, error: 'no token set: open the extension options' }
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  const res = await fetch(`${base}/_bridge/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...VERSION_HEADER },
    body: JSON.stringify({ sessionId, events }),
  })
  if (!res.ok) return { ok: false, error: `daemon answered ${res.status}: ${(await res.text()).slice(0, 200)}` }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// The Driver tab (#1332): one pinned background tab that serves every watched session.
//
// The extension cannot know a cloud run started: it only sees pages it is injected into. So the
// daemon publishes which sessions are ours, and this keeps one tab open on claude.ai whose content
// script reads claude.ai's own session list — the status icon beside each session says whether it
// stopped for its user — and visits only the sessions that need it, navigating inside the app.
// One tab for fifty sessions, where there used to be a tab each, capped at three.

const DRIVER_URL = 'https://claude.ai/code'

/** How often a cycle runs; the floor Chrome allows for an alarm. */
const CYCLE_MINUTES = 0.5

/**
 * How often the Driver's page is reloaded before its list is read. The list refreshes only on a
 * page load — after an in-app navigation it still shows what it showed before (measured
 * 2026-08-25) — so a fresh read costs one load, at the rate the old tab sweep used to poll.
 */
const LIST_REFRESH_MS = 60_000

/** How long to give the Driver's page to load and its content script to answer. */
const TAB_LOAD_MS = 30_000
const SCRIPT_RETRIES = 10

/** A cycle in flight, so the next alarm does not start a second one over it. */
let cycling = false
/** When the Driver's page was last loaded fresh. In memory: a new worker reloads once, which is fine. */
let lastReloadAt = 0
/** What the list said and when the session was last visited, per session — the sticky-state memory `planVisits` reads. */
const seen = new Map()

/** The tab id the Driver runs in, or undefined. Stored, so a restarted worker finds its tab again. */
async function driverTabId() {
  const { driverTabId } = await chrome.storage.local.get('driverTabId')
  return driverTabId ?? undefined
}

/**
 * Record what the last cycle did, so the options page can show it.
 *
 * Every early return used to be silent, which is how "the bridge is doing nothing" became
 * unanswerable without reading a service worker console. Each one now says which it was.
 */
async function note(state) {
  await chrome.storage.local.set({ lastCycle: { ...state, at: new Date().toISOString() } })
  return state
}

/** Resolve once the tab reports `complete`, or after {@link TAB_LOAD_MS}. */
function tabLoaded(tabId) {
  return new Promise(resolve => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') done()
    }
    chrome.tabs.onUpdated.addListener(listener)
    setTimeout(done, TAB_LOAD_MS)
  })
}

/**
 * The Driver tab, opened if there is none. A stored tab that is gone is replaced; one that
 * wandered off claude.ai is brought back. On a browser restart Chrome restores pinned tabs under
 * new ids, so a lone pinned claude.ai/code tab is adopted rather than doubled.
 */
async function ensureDriverTab() {
  const stored = await driverTabId()
  if (stored != null) {
    const tab = await chrome.tabs.get(stored).catch(() => undefined)
    if (tab) {
      if (!(tab.url ?? '').startsWith('https://claude.ai/')) {
        await chrome.tabs.update(tab.id, { url: DRIVER_URL })
        await tabLoaded(tab.id)
        lastReloadAt = Date.now()
      }
      return tab
    }
  }
  const pinned = await chrome.tabs.query({ url: `${DRIVER_URL}*`, pinned: true })
  let tab = pinned.length === 1 ? pinned[0] : undefined
  if (!tab) {
    tab = await chrome.tabs.create({ url: DRIVER_URL, active: false, pinned: true })
    await tabLoaded(tab.id)
    lastReloadAt = Date.now()
  }
  await chrome.storage.local.set({ driverTabId: tab.id })
  return tab
}

/** Load the Driver's page fresh, so its session list is current. */
async function reloadDriver(tabId) {
  await chrome.tabs.reload(tabId)
  await tabLoaded(tabId)
  lastReloadAt = Date.now()
}

/**
 * Hand a message to the Driver's content script, retrying while it is still being injected.
 * A script orphaned by an extension reload cannot hear us at all; the tab is ours, so one reload
 * revives it before the retries continue.
 */
async function askDriver(tabId, message) {
  let lastErr
  let reloaded = false
  for (let i = 0; i < SCRIPT_RETRIES; i++) {
    try {
      const outcome = await chrome.tabs.sendMessage(tabId, message)
      if (outcome) return outcome
    } catch (err) {
      lastErr = err
      if (i >= 2 && !reloaded) {
        reloaded = true
        await reloadDriver(tabId)
        continue
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  return { ok: false, note: `the Driver tab never answered: ${String(lastErr?.message ?? lastErr ?? 'no reply')}` }
}

/** One cycle, guarded: an alarm landing mid-cycle does nothing. */
async function cycle() {
  if (cycling) return { ok: false, reason: 'a cycle is already running' }
  cycling = true
  try {
    return await note(await runCycle())
  } catch (err) {
    return note({ ok: false, reason: String(err?.message ?? err) })
  } finally {
    cycling = false
  }
}

async function runCycle() {
  const { daemonUrl, token, autoOpen, driverPaused } = await chrome.storage.local.get(['daemonUrl', 'token', 'autoOpen', 'driverPaused'])
  if (!token) return { ok: false, reason: 'no token set' }
  // Opt-in: driving a tab on someone's behalf should be asked for, not assumed.
  if (autoOpen === false) return { ok: false, reason: 'the Driver tab is switched off' }
  if (driverPaused) return { ok: false, reason: 'the Driver tab was closed; "Open the Driver tab" on the options page resumes it' }
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  for (const body of [...pendingAcks.values()]) await ack(base, token, body)

  let sessions
  try {
    const res = await fetch(`${base}/_bridge/sessions`, { headers: { authorization: `Bearer ${token}`, ...VERSION_HEADER } })
    if (!res.ok) return { ok: false, reason: `daemon answered ${res.status} listing sessions` }
    sessions = (await res.json())?.sessions
  } catch (err) {
    return { ok: false, reason: `could not reach ${base}: ${String(err?.message ?? err)}` }
  }
  sessions = (Array.isArray(sessions) ? sessions : []).filter(s => s?.id)

  // A queued answer forces a visit whatever the list says: it is the one thing the list cannot know.
  const answers = new Map()
  for (const session of sessions) {
    if (!session.answerQueued) continue
    const answer = await fetchAnswer(base, token, session.id)
    if (answer && !deliveredAnswers.has(answer.id)) answers.set(session.id, answer)
  }
  // Claim-on-read (#1328): from here on the request is ours to report, success or failure.
  const start = await claimStart(base, token)
  if (!sessions.length && !start) return { ok: true, reason: 'nothing to drive: no recent cloud sessions, no session to create' }

  const tab = await ensureDriverTab()
  const ids = sessions.map(s => s.id)
  if (ids.length && Date.now() - lastReloadAt >= LIST_REFRESH_MS) await reloadDriver(tab.id)
  const read = ids.length ? await askDriver(tab.id, { type: 'tf-read-list', ids }) : { ok: true, statuses: [] }
  if (!read.ok) {
    if (start) await reportStarted(base, token, start.id, { ok: false, note: read.note })
    return { ok: false, reason: read.note ?? 'the Driver could not read the session list' }
  }
  const statuses = Array.isArray(read.statuses) ? read.statuses : []
  if (statuses.length) {
    await post('/_bridge/statuses', { statuses: statuses.map(({ sessionId, status, label }) => ({ sessionId, status, ...(label ? { label } : {}) })) })
  }

  const now = Date.now()
  const visits = planVisits(statuses, answers, seen, now)
  for (const visit of visits) if (visit.answer) deliveredAnswers.add(visit.answer.id)
  const driven =
    visits.length || start
      ? await askDriver(tab.id, { type: 'tf-drive', visits, ...(start ? { start: { repo: start.repo, branch: start.branch, prompt: start.prompt } } : {}) })
      : { ok: true, visited: [], delivered: [] }
  const visited = Array.isArray(driven.visited) ? driven.visited : []
  const delivered = Array.isArray(driven.delivered) ? driven.delivered : []
  for (const { sessionId, status } of statuses) {
    const before = seen.get(sessionId)
    seen.set(sessionId, { status, visitedAt: visited.some(v => v.id === sessionId && v.ok) ? now : (before?.visitedAt ?? 0) })
  }
  // Every answer handed over is accounted for: delivered as the page reported, or failed with
  // the reason the visit never got to it. A failure releases the claim so it can be retried.
  for (const visit of visits) {
    if (!visit.answer) continue
    const outcome = delivered.find(d => d.id === visit.answer.id) ?? {
      sessionId: visit.id,
      id: visit.answer.id,
      ok: false,
      note: visited.find(v => v.id === visit.id)?.note ?? driven.note ?? 'the Driver did not reach the session',
    }
    if (!outcome.ok) deliveredAnswers.delete(visit.answer.id)
    await ack(base, token, { sessionId: outcome.sessionId, id: outcome.id, ok: Boolean(outcome.ok), ...(outcome.note ? { note: String(outcome.note).slice(0, 300) } : {}) })
  }
  if (start) await reportStarted(base, token, start.id, driven.started ?? { ok: false, note: driven.note ?? 'the Driver did not create the session' })

  const counts = {
    awaiting: statuses.filter(s => s.status === 'awaiting').length,
    unread: statuses.filter(s => s.status === 'unread').length,
    missing: statuses.filter(s => s.status === 'missing').length,
  }
  return {
    ok: driven.ok !== false,
    reason: `read ${statuses.length} of ${ids.length} (${counts.awaiting} awaiting, ${counts.unread} unread, ${counts.missing} missing), visited ${visited.length}, typed ${delivered.filter(d => d.ok).length}${start ? `, created ${driven.started?.ok ? driven.started.sessionId : 'nothing: ' + (driven.started?.note ?? driven.note ?? 'unknown')}` : ''}`,
  }
}

/** Report what a creation attempt did (#1328); the daemon's claim expires on its own if this never lands. */
async function reportStarted(base, token, id, outcome) {
  const ok = Boolean(outcome?.ok && outcome?.sessionId)
  try {
    await fetch(`${base}/_bridge/started`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...VERSION_HEADER },
      body: JSON.stringify({
        id,
        ok,
        ...(ok ? { sessionId: outcome.sessionId } : {}),
        ...(outcome?.note ? { note: String(outcome.note).slice(0, 1500) } : {}),
      }),
    })
  } catch {
    // The claim expires on the daemon, and the request is offered again.
  }
}

/** The options page's button: resume a paused Driver and run a cycle now. */
async function openDriverNow() {
  await chrome.storage.local.set({ driverPaused: false })
  return cycle()
}

// Closing the Driver tab is the user saying stop: the bridge pauses until they reopen it from
// the options page or restart the browser, rather than the tab reappearing half a minute later.
chrome.tabs.onRemoved.addListener(async tabId => {
  if (tabId !== (await driverTabId())) return
  await chrome.storage.local.set({ driverTabId: null, driverPaused: true })
})

chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.local.set({ driverTabId: null, driverPaused: false })
})

// An alarm rather than setInterval: an MV3 service worker is terminated when idle, and a timer
// dies with it. Alarms wake it back up. One beat for everything: a person may be sitting at the
// dashboard watching an answer's spinner, and a run may be waiting for its session.
chrome.alarms.create('tf-cycle', { periodInMinutes: CYCLE_MINUTES })
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tf-cycle') void cycle()
})
void cycle()
