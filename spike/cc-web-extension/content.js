// Spike for the Claude web bridge. Answers one question and nothing else: can an extension
// running in the user's own session reliably find (a) the question a cloud agent is parked on
// and (b) the box an answer would go into?
//
// It sends nothing anywhere. No host permissions are requested, so it cannot: the point is to
// learn whether the DOM is readable before anyone designs a transport around it.

const POLL_MS = 2000

/**
 * The question a parked run is waiting on. Our agents emit it as a fenced JSON block (the
 * await-choices protocol), so the reliable shape to look for is a code block that parses as
 * JSON and carries `options`. Two strategies, most specific first, and we report which one
 * won so the real version can drop the weak one.
 */
function findPendingChoice() {
  for (const el of document.querySelectorAll('pre code, pre')) {
    const text = (el.textContent ?? '').trim()
    if (!text.startsWith('{') || !text.includes('"options"')) continue
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed.options)) return { via: 'code-block', parsed }
    } catch {
      // A partially streamed block is not an error, just not ready yet.
    }
  }
  // Fallback for a page that renders the block as plain text rather than a <pre>.
  const body = document.body?.innerText ?? ''
  const start = body.indexOf('{"title"') >= 0 ? body.indexOf('{"title"') : body.indexOf('{\n  "title"')
  if (start >= 0) {
    const slice = body.slice(start, start + 4000)
    for (let end = slice.length; end > 20; end--) {
      if (slice[end - 1] !== '}') continue
      try {
        const parsed = JSON.parse(slice.slice(0, end))
        if (Array.isArray(parsed.options)) return { via: 'plain-text', parsed }
      } catch {
        // Keep walking the closing braces back.
      }
    }
  }
  return undefined
}

/** The box an answer would be typed into, if this ever becomes two-way. */
function findComposer() {
  const editable = document.querySelector('div[contenteditable="true"]')
  if (editable) return { via: 'contenteditable', el: editable }
  const textarea = document.querySelector('textarea')
  if (textarea) return { via: 'textarea', el: textarea }
  return undefined
}

/** Everything we managed to read, as the report to paste back into the issue. */
function survey() {
  const choice = findPendingChoice()
  const composer = findComposer()
  return {
    url: location.href,
    codeBlocks: document.querySelectorAll('pre').length,
    choiceFound: Boolean(choice),
    choiceVia: choice?.via,
    choiceTitle: choice?.parsed?.title,
    choiceOptions: (choice?.parsed?.options ?? []).map(o => o.label ?? o),
    composerFound: Boolean(composer),
    composerVia: composer?.via,
  }
}

const panel = document.createElement('div')
panel.style.cssText = [
  'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
  'width:340px', 'max-height:60vh', 'overflow:auto',
  'background:#1f2430', 'color:#dbdbdb', 'font:12px/1.45 ui-monospace,monospace',
  'border:1px solid #3a4150', 'border-radius:8px', 'padding:10px 12px',
  'box-shadow:0 6px 24px rgba(0,0,0,.35)',
].join(';')
document.documentElement.appendChild(panel)

let latest = survey()

function render() {
  latest = survey()
  const rows = [
    ['code blocks', latest.codeBlocks],
    ['question found', latest.choiceFound ? `yes (${latest.choiceVia})` : 'no'],
    ['title', latest.choiceTitle ?? '-'],
    ['options', latest.choiceOptions.length ? latest.choiceOptions.join(' | ') : '-'],
    ['composer', latest.composerFound ? latest.composerVia : 'not found'],
  ]
  panel.innerHTML = ''
  const head = document.createElement('div')
  head.textContent = 'The Framework bridge (spike) - reads only'
  head.style.cssText = 'font-weight:600;margin-bottom:6px;color:#a7c080'
  panel.appendChild(head)
  for (const [k, v] of rows) {
    const line = document.createElement('div')
    line.style.cssText = 'display:flex;gap:8px;margin:2px 0'
    const key = document.createElement('span')
    key.style.cssText = 'color:#7f8797;min-width:96px;flex:none'
    key.textContent = k
    const val = document.createElement('span')
    val.style.cssText = 'word-break:break-word'
    val.textContent = String(v)
    line.append(key, val)
    panel.appendChild(line)
  }
  panel.appendChild(button('Copy report', () => {
    void navigator.clipboard.writeText(JSON.stringify(latest, null, 2))
  }))
  // Deliberately fills without submitting: this proves the write path exists without the
  // extension ever speaking for the user.
  panel.appendChild(button('Fill composer (does not send)', () => {
    const composer = findComposer()
    if (!composer) return
    const text = latest.choiceOptions[0] ?? 'test'
    if (composer.via === 'textarea') {
      composer.el.value = text
      composer.el.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      composer.el.focus()
      document.execCommand('insertText', false, text)
    }
  }))
}

function button(label, onClick) {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = 'margin-top:8px;width:100%;padding:5px;cursor:pointer;background:#2d3441;color:#dbdbdb;border:1px solid #3a4150;border-radius:5px;font:inherit'
  b.addEventListener('click', onClick)
  return b
}

render()
setInterval(render, POLL_MS)
