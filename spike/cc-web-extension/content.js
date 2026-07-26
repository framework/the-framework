// Spike for the Claude web bridge. Answers one question and nothing else: can an extension
// running in the user's own session reliably find (a) the question a cloud agent is parked on
// and (b) the box an answer would go into?
//
// It sends nothing anywhere. No host permissions are requested, so it cannot: the point is to
// learn whether the DOM is readable before anyone designs a transport around it.
//
// Round 1 came back with the question plainly on screen but `"options"` absent from
// document.body.innerText, and 32 <code> elements with zero <pre>. So two fixes: look at <code>
// without requiring a <pre> parent, and stop assuming the top document's body is the whole page.
// Shadow roots and iframes are both crossed here, and reported separately so the answer says
// which one it was.

const POLL_MS = 2000
const IS_TOP = window.top === window

/** Every element matching a selector, including inside open shadow roots. */
function deepQueryAll(selector, root = document, seen = new Set()) {
  const out = [...root.querySelectorAll(selector)]
  for (const el of root.querySelectorAll('*')) {
    if (!el.shadowRoot || seen.has(el)) continue
    seen.add(el)
    out.push(...deepQueryAll(selector, el.shadowRoot, seen))
  }
  return out
}

/** How many open shadow roots exist, which tells us whether that is where content hides. */
function countShadowRoots(root = document, seen = new Set()) {
  let n = 0
  for (const el of root.querySelectorAll('*')) {
    if (!el.shadowRoot || seen.has(el)) continue
    seen.add(el)
    n += 1 + countShadowRoots(el.shadowRoot, seen)
  }
  return n
}

/** Page text including shadow content, which plain body.innerText misses. */
function deepText() {
  let text = document.body?.innerText ?? ''
  for (const host of deepQueryAll('*')) {
    if (host.shadowRoot) text += `\n${host.shadowRoot.textContent ?? ''}`
  }
  return text
}

/**
 * The question a parked run is waiting on. Our agents emit it as a fenced JSON block, so the
 * shape to look for is a block that parses as JSON and carries `options`. Strategies run most
 * specific first and the winner is reported, so the real version can drop the weak ones.
 */
/**
 * Pull the first JSON object carrying `options` out of arbitrary surrounding text.
 *
 * Round 2 established the text is reachable, and that matching on a fixed prefix is not good
 * enough: `{"title"` and `{\n  "title"` are two guesses at an indentation nobody promised us,
 * and the block also arrives with prose around it. So this brace-matches instead, tracking
 * strings and escapes so a brace inside a label cannot end the object early.
 */
function extractChoice(text, stats) {
  if (!text.includes('"options"')) return undefined
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth > 0) continue
        const slice = text.slice(i, j + 1)
        if (slice.includes('"options"')) {
          if (stats) stats.candidates++
          try {
            const parsed = JSON.parse(slice)
            if (Array.isArray(parsed.options)) return parsed
            if (stats) stats.parsedWithoutOptions++
          } catch (err) {
            // Not this one, or still streaming. Record why, so a failing report says whether
            // the block was never found or found and unparseable.
            if (stats) {
              stats.parseErrors++
              stats.lastError = String(err.message ?? err).slice(0, 80)
            }
          }
        }
        break
      }
    }
  }
  return undefined
}

/**
 * The question a parked run is waiting on. Our agents emit it as a fenced JSON block carrying
 * `options`. Element-scoped first so the winner names where it was found, then the whole page
 * as a fallback for a block split across elements by a syntax highlighter.
 */
function findPendingChoice() {
  // `code` on its own: the page has <code> blocks with no <pre> wrapper (round 1), and they
  // sit inside shadow roots (round 2).
  for (const el of deepQueryAll('pre code, pre, code')) {
    const parsed = extractChoice(el.textContent ?? '')
    if (parsed) return { via: el.tagName.toLowerCase(), parsed }
  }
  const parsed = extractChoice(deepText())
  return parsed ? { via: 'page-text', parsed } : undefined
}

/** The box an answer would be typed into, if this ever becomes two-way. */
function findComposer() {
  const editable = deepQueryAll('div[contenteditable="true"]')[0]
  if (editable) return { via: 'contenteditable', el: editable }
  const textarea = deepQueryAll('textarea')[0]
  if (textarea) return { via: 'textarea', el: textarea }
  return undefined
}

/**
 * What the page looks like when extraction fails. Structure and lengths only, never message
 * text, so the report stays safe to paste into a public issue.
 */
function diagnostics() {
  const codes = deepQueryAll('pre, code')
    .map(el => (el.textContent ?? '').trim())
    .filter(t => t.includes('"options"') || t.startsWith('{'))
  const frames = [...document.querySelectorAll('iframe')]
  let reachableFrames = 0
  for (const f of frames) {
    try {
      if (f.contentDocument?.body) reachableFrames++
    } catch {
      // Cross origin, which is itself the answer.
    }
  }
  const deep = deepText()
  // Did the brace matcher find object-shaped candidates, and did any fail to parse? This is
  // what separates "never found it" from "found it and could not read it".
  const stats = { candidates: 0, parseErrors: 0, parsedWithoutOptions: 0, lastError: '' }
  extractChoice(deep, stats)
  return {
    frame: IS_TOP ? 'top' : 'child',
    jsonCandidates: stats.candidates,
    jsonParseErrors: stats.parseErrors,
    jsonLastError: stats.lastError,
    pre: deepQueryAll('pre').length,
    code: deepQueryAll('code').length,
    jsonishBlocks: codes.length,
    shadowRoots: countShadowRoots(),
    iframes: frames.length,
    reachableFrames,
    contentEditables: deepQueryAll('div[contenteditable="true"]').length,
    textareas: deepQueryAll('textarea').length,
    // The decisive pair: does the block exist in the top body, and does it exist once
    // shadow content is included?
    optionsInBodyText: (document.body?.innerText ?? '').includes('"options"'),
    optionsInDeepText: deep.includes('"options"'),
    deepTextLength: deep.length,
  }
}

function survey() {
  const choice = findPendingChoice()
  const composer = findComposer()
  return {
    url: location.href,
    choiceFound: Boolean(choice),
    choiceVia: choice?.via,
    choiceTitle: choice?.parsed?.title,
    choiceOptions: (choice?.parsed?.options ?? []).map(o => o.label ?? o),
    composerFound: Boolean(composer),
    composerVia: composer?.via,
    diagnostics: diagnostics(),
  }
}

// A child frame has no panel of its own: it reports upward, so the top frame's report says
// whether the content was in a frame and which one. This is what settles the iframe question.
if (!IS_TOP) {
  const send = () => {
    const s = survey()
    if (s.choiceFound || s.diagnostics.jsonishBlocks || s.diagnostics.optionsInDeepText) {
      parent.postMessage({ __tfBridge: s }, '*')
    }
  }
  send()
  setInterval(send, POLL_MS)
} else {
  let fromFrame
  window.addEventListener('message', e => {
    if (e.data && typeof e.data === 'object' && e.data.__tfBridge) fromFrame = e.data.__tfBridge
  })

  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
    'width:360px', 'max-height:70vh', 'overflow:auto',
    'background:#1f2430', 'color:#dbdbdb', 'font:12px/1.45 ui-monospace,monospace',
    'border:1px solid #3a4150', 'border-radius:8px', 'padding:10px 12px',
    'box-shadow:0 6px 24px rgba(0,0,0,.35)',
  ].join(';')
  document.documentElement.appendChild(panel)

  let latest = survey()

  const button = (label, onClick) => {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText = 'margin-top:8px;width:100%;padding:5px;cursor:pointer;background:#2d3441;color:#dbdbdb;border:1px solid #3a4150;border-radius:5px;font:inherit'
    b.addEventListener('click', onClick)
    return b
  }

  const render = () => {
    const top = survey()
    // A child frame's find wins: it means the content lives there, which is the finding.
    latest = { ...top, fromFrame: fromFrame ?? null }
    const winner = top.choiceFound ? top : fromFrame?.choiceFound ? fromFrame : top
    const d = top.diagnostics
    const rows = [
      ['question found', winner.choiceFound ? `yes (${winner.choiceVia}${winner === fromFrame ? ', in iframe' : ''})` : 'no'],
      ['title', winner.choiceTitle ?? '-'],
      ['options', winner.choiceOptions?.length ? winner.choiceOptions.join(' | ') : '-'],
      ['composer', top.composerFound ? top.composerVia : 'not found'],
    ]
    if (!winner.choiceFound) {
      rows.push(
        ['code / pre', `${d.code} / ${d.pre}`],
        ['shadow roots', d.shadowRoots],
        ['iframes', `${d.iframes} (reachable ${d.reachableFrames})`],
        ['"options" body', String(d.optionsInBodyText)],
        ['"options" deep', String(d.optionsInDeepText)],
        ['json candidates', `${d.jsonCandidates} (parse errors ${d.jsonParseErrors})`],
        ...(d.jsonLastError ? [['last parse error', d.jsonLastError]] : []),
        ['frame reported', fromFrame ? 'yes' : 'no'],
      )
    }
    panel.innerHTML = ''
    const head = document.createElement('div')
    head.textContent = 'The Framework bridge (spike) - reads only'
    head.style.cssText = 'font-weight:600;margin-bottom:6px;color:#a7c080'
    panel.appendChild(head)
    for (const [k, v] of rows) {
      const line = document.createElement('div')
      line.style.cssText = 'display:flex;gap:8px;margin:2px 0'
      const key = document.createElement('span')
      key.style.cssText = 'color:#7f8797;min-width:104px;flex:none'
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
    // Fills without submitting, on purpose: it proves the write path exists without the
    // extension ever speaking for the user.
    panel.appendChild(button('Fill composer (does not send)', () => {
      const composer = findComposer()
      if (!composer) return
      const text = winner.choiceOptions?.[0] ?? 'test'
      if (composer.via === 'textarea') {
        composer.el.value = text
        composer.el.dispatchEvent(new Event('input', { bubbles: true }))
      } else {
        composer.el.focus()
        document.execCommand('insertText', false, text)
      }
    }))
  }

  render()
  setInterval(render, POLL_MS)
}
