// Runs the content script against a synthetic page carrying the exact await-choices block our
// agents emit, so the parsing half is proven without needing anyone's browser or a live session.
//
// What this does NOT prove is the only thing left: whether claude.ai's real DOM puts the block
// somewhere these strategies reach. That is what loading the extension answers.
//
//   node --experimental-vm-modules check.mjs      (from this directory, after a repo pnpm install)

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
// jsdom belongs to the-framework (the dashboard's dev dependency, merged in with it); this
// directory deliberately has no package.json of its own, so resolve through the package that
// actually depends on it.
const require_ = createRequire(import.meta.url)
const { JSDOM } = require_(require_.resolve('jsdom', { paths: [join(here, '../the-framework')] }))

const block = JSON.stringify(
  {
    title: 'What would you like me to do?',
    options: [{ label: 'Work on the next TODO' }, { label: 'Tell you about current state' }, { label: "I'll tell you what to do" }],
    recommended: 'Work on the next TODO',
  },
  null,
  2,
)

// Indented differently on purpose: the parser must not depend on an indentation nobody
// promised, which is what round 2 of the spike failed on.
const wideBlock = JSON.stringify(JSON.parse(block), null, 4)
// A highlighter splits a block into per-token elements; textContent still rejoins it.
const highlighted = wideBlock
  .split('\n')
  .map(line => `<span class="line">${line.replace(/</g, '&lt;')}</span>`)
  .join('\n')

// The await-choices spec exactly as our system prompt states it, placeholders and all.
// Escaped, because these fixtures go in through innerHTML and `<the question>` would otherwise
// be parsed as an HTML tag and vanish from textContent. The real page escapes it too.
const esc = t => t.replace(/</g, '&lt;').replace(/>/g, '&gt;')
const SPEC = esc(JSON.stringify({
  title: '<the question>',
  options: [{ label: '<option>', detail: '<optional one-liner>' }],
  recommended: '<the label to default to>',
}, null, 2))

const cases = [
  ['fenced code block', `<pre><code>${block}</code></pre><div contenteditable="true"></div>`, true],
  ['pre without code', `<pre>${block}</pre><textarea></textarea>`, true],
  // The shape claude.ai actually uses: <code> with no <pre> wrapper at all (round 1).
  ['code without pre', `<code>${block}</code><div contenteditable="true"></div>`, true],
  ['four space indent', `<code>${wideBlock}</code><div contenteditable="true"></div>`, true],
  ['split across spans by a highlighter', `<code>${highlighted}</code><div contenteditable="true"></div>`, true],
  ['prose around the block', `<div>Your prompt "hi" is ambiguous! Let me clarify:</div><code>${block}</code><div>anything else?</div><div contenteditable="true"></div>`, true],
  // Round 2's finding: the message body lives behind a shadow root, so nothing in the light
  // DOM sees it. Built after parse, below.
  ['inside a shadow root', { shadow: block }, true],
  ['no question present', `<pre><code>console.log(1)</code></pre><div contenteditable="true"></div>`, false],
  // Round 3's finding: the page renders our system prompt, so the await-protocol spec appears
  // as a JSON block with `options` before the agent has asked anything. Taking the first match
  // reported "<the question>" as the question. The spec must lose to the real one.
  ['protocol spec then the real question', `<pre><code>${SPEC}</code></pre><code>${block}</code><div contenteditable="true"></div>`, true],
  // And on a session that has not asked yet, the spec alone must not count as a question.
  ['protocol spec only', `<pre><code>${SPEC}</code></pre><div contenteditable="true"></div>`, false],
]

const script = readFileSync(join(here, 'content.js'), 'utf8')
let failed = 0

for (const [name, body, expectFound] of cases) {
  const shadow = typeof body === 'object' ? body.shadow : undefined
  const light = shadow ? '<div id="host"></div><div contenteditable="true"></div>' : body
  const dom = new JSDOM(`<!doctype html><html><body><main>${light}</main></body></html>`, {
    url: 'https://claude.ai/code/session_01TEST',
    runScripts: 'outside-only',
  })
  if (shadow) {
    const host = dom.window.document.getElementById('host')
    host.attachShadow({ mode: 'open' }).innerHTML = `<code>${shadow}</code>`
  }
  dom.window.eval(script)
  // The panel is appended to documentElement, so it is a direct child rather than in the body.
  const text = [...dom.window.document.documentElement.children]
    .filter(el => el.tagName === 'DIV')
    .map(el => el.textContent)
    .join(' ')
  const found = /question found\s*yes/.test(text)
  const composerOk = /composer\s*(contenteditable|textarea)/.test(text)
  const titleOk = !expectFound || /What would you like me to do\?/.test(text)
  const ok = found === expectFound && composerOk && titleOk
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (found=${found}, expected=${expectFound}, composer=${composerOk}, title=${titleOk})`)
  dom.window.close()
}

// ---------------------------------------------------------------------------
// The write half (#1237): the dashboard's pick being typed into the composer and submitted.
// jsdom has no execCommand, so these exercise the fallback fill; what they prove is the flow
// around it: the composer is filled, a labelled send button is preferred, Enter is the
// fallback, and a page with no composer is refused rather than guessed at.

async function deliver(body, prepare) {
  const dom = new JSDOM(`<!doctype html><html><body><main>${body}</main></body></html>`, {
    url: 'https://claude.ai/code/session_01TEST',
    runScripts: 'outside-only',
  })
  dom.window.eval(script)
  const observed = prepare ? prepare(dom.window) : undefined
  const result = await dom.window.__tfBridgeDeliverAnswer('Work on the next TODO')
  return { dom, result, observed }
}

{
  const { dom, result, observed } = await deliver(
    `<div contenteditable="true"></div><button aria-label="Send message" id="send"></button>`,
    w => {
      const seen = { clicked: false }
      w.document.getElementById('send').addEventListener('click', () => {
        seen.clicked = true
      })
      return seen
    },
  )
  const text = dom.window.document.querySelector('[contenteditable="true"]').textContent
  const ok = result.ok && observed.clicked && /clicked send button/.test(result.note) && text === 'Work on the next TODO'
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  answer fills the composer and clicks send  (clicked=${observed.clicked}, text="${text}")`)
  dom.window.close()
}

{
  const { dom, result, observed } = await deliver(`<div contenteditable="true"></div>`, w => {
    const seen = { enter: false }
    w.document.querySelector('[contenteditable="true"]').addEventListener('keydown', e => {
      if (e.key === 'Enter') seen.enter = true
    })
    return seen
  })
  const ok = result.ok && observed.enter && /sent Enter/.test(result.note)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  answer falls back to Enter without a send button  (enter=${observed.enter})`)
  dom.window.close()
}

{
  const { dom, result } = await deliver(`<p>nothing to type into</p>`, w => {
    // Shorten the composer wait: this page never gains one, and the real 20s is for claude.ai
    // still rendering after a tab revive.
    w.__tfComposerWaitMs = 100
    return undefined
  })
  const ok = !result.ok && /no composer/.test(result.note)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  answer refuses honestly when there is no composer  (ok=${result.ok})`)
  dom.window.close()
}

// ---------------------------------------------------------------------------
// The collapse toggle: the panel folds down to a compact "TF" tab — the full title retreats to
// the tooltip so the fold actually gives the corner back — and unfolds with the rows intact.
// chrome.storage is extension-only, so in jsdom the fold simply lives for the page's lifetime,
// which is exactly the degradation the guard in content.js promises.

{
  const dom = new JSDOM(
    `<!doctype html><html><body><main><pre><code>${block}</code></pre><div contenteditable="true"></div></main></body></html>`,
    { url: 'https://claude.ai/code/session_01TEST', runScripts: 'outside-only' },
  )
  dom.window.eval(script)
  const panel = dom.window.document.getElementById('tf-bridge-panel')
  // The toggle is the one button carrying aria-expanded; Copy report and Fill composer do not.
  const toggle = () => panel.querySelector('button[aria-expanded]')
  const expanded = /question found/.test(panel.textContent) && /The Framework bridge/.test(panel.textContent)
  toggle().click()
  const folded =
    !/question found/.test(panel.textContent) &&
    !/The Framework bridge/.test(panel.textContent) &&
    /TF/.test(panel.textContent) &&
    toggle().getAttribute('aria-expanded') === 'false'
  toggle().click()
  const restored = /question found\s*yes/.test(panel.textContent)
  const ok = expanded && folded && restored
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  panel folds to a compact TF tab and back  (expanded=${expanded}, folded=${folded}, restored=${restored})`)
  dom.window.close()
}

console.log(failed ? `\n${failed} case(s) failed` : '\nall cases passed')
process.exit(failed ? 1 : 0)
