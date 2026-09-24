import { KEYS } from './page.js'
import type { CdpSession } from './cdp.js'

/**
 * What a person watching the screen sends back, and the DevTools calls it becomes. Anything not
 * recognized becomes no call at all: a malformed request never reaches Chrome.
 */
export type ScreenInput =
  | { type: 'click'; x: number; y: number }
  | { type: 'scroll'; x: number; y: number; deltaY: number }
  | { type: 'text'; text: string }
  | { type: 'key'; key: string }
  | { type: 'navigate'; url: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }

export interface CdpCall {
  method: string
  params: Record<string, unknown>
}

/** The calls one input maps to; `back` and `forward` need the history, so they are the caller's. */
export function inputCalls(input: ScreenInput): CdpCall[] {
  switch (input?.type) {
    case 'click': {
      if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return []
      const base = { x: input.x, y: input.y, button: 'left', clickCount: 1 }
      return [
        { method: 'Input.dispatchMouseEvent', params: { ...base, type: 'mousePressed' } },
        { method: 'Input.dispatchMouseEvent', params: { ...base, type: 'mouseReleased' } },
      ]
    }
    case 'scroll':
      if (!Number.isFinite(input.x) || !Number.isFinite(input.y) || !Number.isFinite(input.deltaY)) return []
      return [{ method: 'Input.dispatchMouseEvent', params: { type: 'mouseWheel', x: input.x, y: input.y, deltaX: 0, deltaY: input.deltaY } }]
    case 'text':
      if (typeof input.text !== 'string' || input.text === '') return []
      return [{ method: 'Input.insertText', params: { text: input.text } }]
    case 'key': {
      const known = typeof input.key === 'string' ? KEYS[input.key] : undefined
      if (!known) return []
      const event = { key: input.key === 'Space' ? ' ' : input.key, code: known.code, windowsVirtualKeyCode: known.keyCode, ...(known.text ? { text: known.text } : {}) }
      return [
        { method: 'Input.dispatchKeyEvent', params: { ...event, type: 'keyDown' } },
        { method: 'Input.dispatchKeyEvent', params: { ...event, type: 'keyUp' } },
      ]
    }
    case 'navigate':
      if (typeof input.url !== 'string' || !/^https?:\/\//i.test(input.url)) return []
      return [{ method: 'Page.navigate', params: { url: input.url } }]
    case 'reload':
      return [{ method: 'Page.reload', params: {} }]
    default:
      return []
  }
}

/** Go one step back or forward in the page's history; nothing when there is no such step. */
export async function stepHistory(page: CdpSession, by: -1 | 1): Promise<void> {
  const { currentIndex, entries } = await page.send<{ currentIndex: number; entries: { id: number }[] }>('Page.getNavigationHistory')
  const entry = entries[currentIndex + by]
  if (entry) await page.send('Page.navigateToHistoryEntry', { entryId: entry.id })
}

/** One MJPEG part: the multipart header for one frame, the JPEG, the line break. */
export function framePart(boundary: string, jpeg: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`), jpeg, Buffer.from('\r\n')])
}

/**
 * The screen page: the browser's address bar (back, forward, reload, the address) over the live
 * picture. A click, a scroll and typing on the picture go to the page. It reads its token from its
 * own address and sends it with every request; it needs nothing from whoever frames it.
 */
export const SCREEN_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>browser</title>
<style>
  :root { color-scheme: light dark; --bg: #fff; --bar: #f3f4f6; --line: #d1d5db; --text: #111827; --muted: #6b7280; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b0b0c; --bar: #1c1c1f; --line: #3f3f46; --text: #f4f4f5; --muted: #a1a1aa; } }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 13px system-ui, sans-serif; }
  body { display: flex; flex-direction: column; }
  form { display: flex; gap: 4px; align-items: center; padding: 4px 6px; background: var(--bar); border-bottom: 1px solid var(--line); }
  button { border: 0; background: none; color: var(--text); font-size: 15px; width: 26px; height: 24px; border-radius: 4px; cursor: pointer; }
  button:hover { background: var(--line); }
  input { flex: 1; min-width: 0; border: 1px solid var(--line); border-radius: 12px; padding: 3px 10px; background: var(--bg); color: var(--text); font: inherit; }
  main { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  img { max-width: 100%; max-height: 100%; cursor: default; outline: none; }
  img:focus { box-shadow: 0 0 0 2px #3b82f6; }
  p { color: var(--muted); padding: 12px; text-align: center; }
</style>
</head>
<body>
<form id="bar">
  <button type="button" id="back" title="Back">&#9664;</button>
  <button type="button" id="forward" title="Forward">&#9654;</button>
  <button type="button" id="reload" title="Reload">&#10227;</button>
  <input id="address" spellcheck="false" autocomplete="off" aria-label="Address">
</form>
<main><img id="screen" tabindex="0" alt="The agent's browser"></main>
<script>
  const token = new URLSearchParams(location.search).get('t') || ''
  const q = '?t=' + encodeURIComponent(token)
  const img = document.getElementById('screen')
  const address = document.getElementById('address')
  const send = body => fetch('/input' + q, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
  img.src = '/stream' + q
  img.onerror = () => { document.querySelector('main').innerHTML = '<p>The browser is closed.</p>' }
  const at = e => { const r = img.getBoundingClientRect(); return { x: Math.round((e.clientX - r.left) / r.width * (img.naturalWidth || r.width)), y: Math.round((e.clientY - r.top) / r.height * (img.naturalHeight || r.height)) } }
  img.addEventListener('click', e => { img.focus(); send({ type: 'click', ...at(e) }) })
  img.addEventListener('wheel', e => { e.preventDefault(); send({ type: 'scroll', ...at(e), deltaY: e.deltaY }) }, { passive: false })
  const named = { Enter: 'Enter', Tab: 'Tab', Escape: 'Escape', Backspace: 'Backspace', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' }
  img.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (named[e.key]) { e.preventDefault(); send({ type: 'key', key: named[e.key] }) }
    else if (e.key.length === 1) { e.preventDefault(); send({ type: 'text', text: e.key }) }
  })
  for (const id of ['back', 'forward', 'reload']) document.getElementById(id).onclick = () => send({ type: id })
  let editing = false
  address.onfocus = () => { editing = true }
  address.onblur = () => { editing = false }
  document.getElementById('bar').onsubmit = e => {
    e.preventDefault()
    let url = address.value.trim()
    if (!/^https?:\\/\\//i.test(url)) url = 'http://' + url
    send({ type: 'navigate', url })
    address.blur()
  }
  const poll = () => fetch('/state' + q).then(r => r.json()).then(s => { if (!editing) address.value = s.url; document.title = s.title || 'browser' }).catch(() => {})
  poll()
  setInterval(poll, 1000)
</script>
</body>
</html>
`
