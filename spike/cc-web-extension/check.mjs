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
// jsdom belongs to the dashboard package; this directory is outside the workspace globs on
// purpose, so resolve through the package that actually depends on it.
const require_ = createRequire(import.meta.url)
const { JSDOM } = require_(require_.resolve('jsdom', { paths: [join(here, '../../packages/framework-dashboard')] }))

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

console.log(failed ? `\n${failed} case(s) failed` : '\nall cases passed')
process.exit(failed ? 1 : 0)
