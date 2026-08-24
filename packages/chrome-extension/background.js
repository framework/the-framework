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

const DEFAULT_DAEMON = 'http://localhost:4200'

// Every daemon call states this extension's version, and a daemon expecting another refuses it
// outright (#1519): a version-skewed extension half-works in ways that read as dashboard bugs,
// so the daemon blocks rather than degrades, and the error it answers names both versions.
const VERSION_HEADER = { 'x-tf-extension-version': chrome.runtime.getManifest().version }

/** What we last successfully reported per session, so a re-render does not re-post. */
const lastSent = new Map()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Run the sweep on demand, so the options page can prove it works without waiting on an alarm.
  if (message?.type === 'tf-open-now') {
    void openWatchedTabs()
      .then(sendResponse)
      .catch(err => sendResponse({ ok: false, reason: String(err?.message ?? err) }))
    return true
  }
  if (message?.type === 'tf-hello') {
    void post('/_bridge/hello', { version: message.version, sessionId: message.sessionId, note: message.note })
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }))
    return true
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
  // A reported question is one the dashboard may answer, so look for that answer on the same
  // beat: the page mutating is also when a parked session is most likely to have been dealt with.
  void deliverAnswers([question.sessionId])
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Answers travelling back (#1237): the dashboard queues a pick, this collects it, hands it to
// the content script in the session's tab, and reports what the delivery did.

/** Answer ids already handed to a tab, so a slow ack cannot double-submit into the session. */
const deliveredAnswers = new Set()

/** Acks that failed to reach the daemon, retried on the next poll rather than dropped. */
const pendingAcks = new Map()

/** How often to look for queued answers; the floor Chrome allows for an alarm. */
const ANSWER_POLL_MINUTES = 0.5

/**
 * Fetch and deliver any queued answer for these sessions.
 *
 * Delivery goes tab-first on purpose: acknowledging before typing would mark an answer `sent`
 * that a dying tab never sent, and the dashboard would show a session as answered while it sits
 * parked. The cost is the reverse race, a delivered answer whose ack is lost being delivered
 * again, which `deliveredAnswers` prevents for the worker's lifetime and the daemon's own
 * answer id makes harmless beyond it.
 */
async function deliverAnswers(sessionIds) {
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  for (const sessionId of sessionIds) {
    let answer
    try {
      const res = await fetch(`${base}/_bridge/answer?sessionId=${sessionId}`, {
        headers: { authorization: `Bearer ${token}`, ...VERSION_HEADER },
      })
      if (!res.ok) continue
      answer = (await res.json())?.answer
    } catch {
      continue
    }
    if (!answer?.id || typeof answer.text !== 'string' || deliveredAnswers.has(answer.id)) continue

    const tabs = await chrome.tabs.query({ url: 'https://claude.ai/code/*' })
    const tab = tabs.find(t => (/\/code\/(session_[A-Za-z0-9]+)/.exec(t.url ?? '') ?? [])[1] === sessionId)
    // No tab means nothing to type into; leave the answer queued for when one exists.
    if (tab?.id == null) continue

    deliveredAnswers.add(answer.id)
    let outcome
    try {
      outcome = await chrome.tabs.sendMessage(tab.id, { type: 'tf-deliver-answer', text: answer.text })
    } catch (err) {
      // A tab that cannot hear us is either discarded or carrying a content script orphaned by
      // an extension reload. If it is our own pinned tab, a reload revives it; someone else's
      // tab is not ours to reload, it might hold composer text they typed.
      if ((await openedTabs())[tab.id]) {
        await chrome.tabs.reload(tab.id).catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 5000))
        try {
          outcome = await chrome.tabs.sendMessage(tab.id, { type: 'tf-deliver-answer', text: answer.text })
        } catch (err2) {
          outcome = { ok: false, note: `tab did not answer after a reload: ${String(err2?.message ?? err2)}` }
        }
      } else {
        outcome = { ok: false, note: `tab did not answer (reload it): ${String(err?.message ?? err)}` }
      }
    }
    if (!outcome) outcome = { ok: false, note: 'no reply from the content script' }
    // A failed attempt may be retried once the page recovers, so it does not stay claimed.
    if (!outcome.ok) deliveredAnswers.delete(answer.id)
    await ack(base, token, { sessionId, id: answer.id, ok: Boolean(outcome.ok), ...(outcome.note ? { note: String(outcome.note).slice(0, 300) } : {}) })
  }
}

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

/** Every session the daemon watches, checked for queued answers. */
async function pollAnswers() {
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  for (const body of [...pendingAcks.values()]) await ack(base, token, body)
  let sessions
  try {
    const res = await fetch(`${base}/_bridge/sessions`, { headers: { authorization: `Bearer ${token}`, ...VERSION_HEADER } })
    if (!res.ok) return
    sessions = (await res.json())?.sessions
  } catch {
    return
  }
  if (!Array.isArray(sessions)) return
  await deliverAnswers(sessions.map(s => s?.id).filter(Boolean))
}

// ---------------------------------------------------------------------------
// Creating sessions (#1328): the daemon queues a repo, a branch and a prompt; this claims the
// next one, opens the new-session page in a pinned tab, has the content script drive it, and
// reports the session it became. One at a time: creation navigates a page, so two at once would
// race each other's chips.

/** A creation in flight, so a poll landing mid-way does not start a second tab. */
let creating = false

/** How long to give the new-session page to load and its content script to answer. */
const NEW_SESSION_URL = 'https://claude.ai/code'
const TAB_LOAD_MS = 30_000
const SCRIPT_RETRIES = 10

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

/** Hand the request to the content script, retrying while it is still being injected. */
async function askPage(tabId, start) {
  let lastErr
  for (let i = 0; i < SCRIPT_RETRIES; i++) {
    try {
      const outcome = await chrome.tabs.sendMessage(tabId, { type: 'tf-create-session', start })
      if (outcome) return outcome
    } catch (err) {
      lastErr = err
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  return { ok: false, note: `the new-session page never answered: ${String(lastErr?.message ?? lastErr ?? 'no reply')}` }
}

async function pollStarts() {
  if (creating) return
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  let start
  try {
    const res = await fetch(`${base}/_bridge/start`, { headers: { authorization: `Bearer ${token}`, ...VERSION_HEADER } })
    if (!res.ok) return
    start = (await res.json())?.start
  } catch {
    return
  }
  if (!start?.id || typeof start.repo !== 'string' || typeof start.branch !== 'string' || typeof start.prompt !== 'string') return

  creating = true
  let tab
  let outcome
  try {
    tab = await chrome.tabs.create({ url: NEW_SESSION_URL, active: false, pinned: true })
    await tabLoaded(tab.id)
    outcome = await askPage(tab.id, { repo: start.repo, branch: start.branch, prompt: start.prompt })
  } catch (err) {
    outcome = { ok: false, note: `could not drive a new-session tab: ${String(err?.message ?? err)}` }
  }
  const ok = Boolean(outcome?.ok && outcome?.sessionId)
  if (tab?.id != null) {
    // A created session's tab is now a watched tab like any other; a failed attempt's tab goes,
    // its note carries what the page looked like.
    if (ok) await chrome.storage.local.set({ openedTabs: { ...(await openedTabs()), [tab.id]: outcome.sessionId } })
    else await chrome.tabs.remove(tab.id).catch(() => {})
  }
  try {
    await fetch(`${base}/_bridge/started`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...VERSION_HEADER },
      body: JSON.stringify({
        id: start.id,
        ok,
        ...(ok ? { sessionId: outcome.sessionId } : {}),
        ...(outcome?.note ? { note: String(outcome.note).slice(0, 1500) } : {}),
      }),
    })
  } catch {
    // The claim expires on the daemon, and the request is offered again.
  }
  await note({ ok, reason: ok ? `created ${outcome.sessionId}` : `session creation failed: ${outcome?.note ?? 'unknown'}` })
  creating = false
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
// Opening the tabs, so the bridge does not depend on the user happening to be
// looking at claude.ai (#1237).
//
// The extension cannot know a cloud run started: it only sees pages it is injected into. So the
// daemon publishes which sessions are worth watching and this opens one pinned background tab
// each. Pinned and inactive on purpose: the point is that nobody has to look at it.

const SESSION_POLL_MINUTES = 1

/**
 * Sessions whose tab the user closed. Reopening one they dismissed is user-hostile.
 *
 * The key is versioned because the first version of this poisoned itself: it marked every
 * watched session that had no tab open, so the moment any one claude.ai tab closed, all of them
 * were dismissed forever and no tab ever opened again. Old lists are discarded rather than
 * migrated, since every entry in them is suspect.
 */
async function dismissed() {
  const { dismissedSessionsV2 } = await chrome.storage.local.get('dismissedSessionsV2')
  return new Set(dismissedSessionsV2 ?? [])
}

/** Which session each tab we opened is showing, so a close can be attributed to one of them. */
async function openedTabs() {
  const { openedTabs } = await chrome.storage.local.get('openedTabs')
  return openedTabs ?? {}
}

/**
 * Record what the last attempt did, so the options page can show it.
 *
 * Every early return below used to be silent, which is how "tabs are not opening" became
 * unanswerable without reading a service worker console. Each one now says which it was.
 */
async function note(state) {
  await chrome.storage.local.set({ lastOpen: { ...state, at: new Date().toISOString() } })
  return state
}

async function openWatchedTabs() {
  const { daemonUrl, token, autoOpen } = await chrome.storage.local.get(['daemonUrl', 'token', 'autoOpen'])
  if (!token) return note({ ok: false, reason: 'no token set' })
  // Opt-in: opening tabs on someone's behalf should be asked for, not assumed.
  if (autoOpen === false) return note({ ok: false, reason: 'tab opening is switched off' })
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')

  let sessions
  try {
    const res = await fetch(`${base}/_bridge/sessions`, { headers: { authorization: `Bearer ${token}`, ...VERSION_HEADER } })
    if (!res.ok) return note({ ok: false, reason: `daemon answered ${res.status} listing sessions` })
    sessions = (await res.json())?.sessions
  } catch (err) {
    return note({ ok: false, reason: `could not reach ${base}: ${String(err?.message ?? err)}` })
  }
  if (!Array.isArray(sessions) || !sessions.length) return note({ ok: true, opened: 0, reason: 'no recent cloud sessions' })

  const skip = await dismissed()
  // One tab per session: match on the session id in the URL rather than the whole string, since
  // claude.ai rewrites the query (?from=cli&m=0) once the page loads.
  const open = await chrome.tabs.query({ url: 'https://claude.ai/code/*' })
  const already = new Set(open.map(t => /\/code\/(session_[A-Za-z0-9]+)/.exec(t.url ?? '')?.[1]).filter(Boolean))

  let opened = 0
  const skipped = []
  for (const session of sessions) {
    if (!session?.id || !session?.url) continue
    if (already.has(session.id)) {
      skipped.push('already open')
      continue
    }
    if (skip.has(session.id)) {
      skipped.push('you closed it')
      continue
    }
    try {
      const tab = await chrome.tabs.create({ url: session.url, active: false, pinned: true })
      // Remember which session this tab is, because a close event carries only the tab id and
      // by then the URL is gone.
      if (tab?.id != null) await chrome.storage.local.set({ openedTabs: { ...(await openedTabs()), [tab.id]: session.id } })
      opened++
    } catch (err) {
      return note({ ok: false, reason: `chrome.tabs.create failed: ${String(err?.message ?? err)}` })
    }
  }
  const closed = await closeStaleTabs(new Set(sessions.map(s => s.id)))
  return note({ ok: true, opened, of: sessions.length, ...(closed ? { closed } : {}), ...(skipped.length ? { skipped: skipped.join(', ') } : {}) })
}

/**
 * Close tabs we opened for sessions the daemon no longer watches.
 *
 * Without this a browser gains a pinned tab per run and never loses one, which is its own kind
 * of broken. Only tabs this extension opened: a session the user opened themselves is theirs.
 */
async function closeStaleTabs(watched) {
  const opened = await openedTabs()
  const stale = Object.entries(opened).filter(([, sessionId]) => !watched.has(sessionId))
  if (!stale.length) return 0
  const rest = { ...opened }
  for (const [tabId] of stale) delete rest[tabId]
  // Drop the record first, so the close does not read as the user dismissing the session.
  await chrome.storage.local.set({ openedTabs: rest })
  for (const [tabId] of stale) await chrome.tabs.remove(Number(tabId)).catch(() => {})
  return stale.length
}

// Remember a closed tab so the next poll does not reopen it.
//
// Only the session whose tab actually closed. The first version asked the daemon what it was
// watching and dismissed everything without an open tab, which meant one close silently
// blacklisted every session and the sweep went quiet for good.
chrome.tabs.onRemoved.addListener(async tabId => {
  const opened = await openedTabs()
  const sessionId = opened[tabId]
  if (!sessionId) return
  const { [tabId]: _gone, ...rest } = opened
  const { dismissedSessionsV2 } = await chrome.storage.local.get('dismissedSessionsV2')
  await chrome.storage.local.set({
    openedTabs: rest,
    dismissedSessionsV2: [...new Set([...(dismissedSessionsV2 ?? []), sessionId])].slice(-50),
  })
})

// An alarm rather than setInterval: an MV3 service worker is terminated when idle, and a timer
// dies with it. Alarms wake it back up.
chrome.alarms.create('tf-sessions', { periodInMinutes: SESSION_POLL_MINUTES })
// Answers get their own faster beat: a person is sitting on the other end of one, watching a
// spinner that says the pick is on its way.
chrome.alarms.create('tf-answers', { periodInMinutes: ANSWER_POLL_MINUTES })
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tf-sessions') void openWatchedTabs()
  if (alarm.name === 'tf-answers') {
    void pollAnswers()
    // Session requests ride the same fast beat: a run is waiting on the other end of one.
    void pollStarts()
  }
})
void openWatchedTabs()
void pollAnswers()
void pollStarts()
