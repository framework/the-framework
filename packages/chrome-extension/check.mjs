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
const { JSDOM } = require_(require_.resolve('jsdom', { paths: [join(here, '../framework')] }))

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

// One conversation turn as claude.ai renders it (#1225): a `transcript-row` naming its position
// and its kind. The page has no <article> elements; this is the shape the mirror reads.
const row = (kind, index, html) => `<div data-testid="transcript-row" data-index="${index}" data-perf-row="${kind}"><div role="article" aria-label="Message ${index + 1}">${html}</div></div>`
const feed = (...rows) => `<div role="feed" aria-label="Chat messages">${rows.join('')}</div>`
const SPEC = esc(JSON.stringify({
  title: '<the question>',
  options: [{ label: '<option>', detail: '<optional one-liner>' }],
  recommended: '<the label to default to>',
}, null, 2))

// The two examples the protocol ships with literal text (#1568): the browser-handoff one has a
// placeholders-plus-punctuation title and real labels, the approval one is literal end to end.
// Both rendered on a live page and were reported as the session's question.
const HANDOFF_EXAMPLE = esc(JSON.stringify({
  title: '<what the human needs to do> (<the page you are stuck on>)',
  options: [{ label: 'Handled it' }, { label: 'Could not handle it', stop: true }],
  recommended: 'Could not handle it',
}, null, 2))
const APPROVAL_EXAMPLE = esc(JSON.stringify({
  title: 'Ship this?',
  options: [{ label: 'Approve' }, { label: 'Decline', stop: true }],
  recommended: 'Approve',
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
  // #1568: the browser-handoff example's title is placeholders joined by punctuation and its
  // labels are literal, so neither of the original isTemplate prongs caught it.
  ['browser-handoff example only', `<pre><code>${HANDOFF_EXAMPLE}</code></pre><div contenteditable="true"></div>`, false],
  // #1568: the approval example is literal end to end and can only be matched verbatim.
  ['approval example only', `<pre><code>${APPROVAL_EXAMPLE}</code></pre><div contenteditable="true"></div>`, false],
  // #1568: everything in the opening turn is the rendered prompt — documentation, not the
  // session asking — and the real question in a later turn still wins.
  [
    'decoys in the opening turn, real question after',
    `${feed(row('human', 0, `<pre><code>${SPEC}</code><code>${HANDOFF_EXAMPLE}</code><code>${APPROVAL_EXAMPLE}</code></pre>`), row('assistant', 1, `<code>${block}</code>`))}<div contenteditable="true"></div>`,
    true,
  ],
  // #1568: a question-shaped block that only exists inside the opening turn is never asked.
  ['question-shaped block only in the opening turn', `${feed(row('human', 0, `<code>${block}</code>`))}<div contenteditable="true"></div>`, false],
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
// The block's shape reaches the daemon whole (#1554): `multi`, and per option `default` and
// `stop`, are what let the dashboard render the gate as a local one and type a stopping pick
// back as a hand-over. Labels/details still travel; unknown keys do not.
{
  const shaped = JSON.stringify({
    title: 'Which checks should run?',
    multi: true,
    options: [
      { label: 'Lint', default: true, extra: 'dropped' },
      { label: 'Tests', detail: 'slow', default: false },
      { label: 'Abandon the plan', stop: true },
    ],
  })
  const dom = new JSDOM(`<!doctype html><html><body><main>${feed(row('human', 0, 'intro'), row('assistant', 1, `<code>${esc(shaped)}</code>`))}<div contenteditable="true"></div></main></body></html>`, {
    url: 'https://claude.ai/code/session_01TEST',
    runScripts: 'outside-only',
  })
  dom.window.eval(script)
  const got = dom.window.__tfBridgeQuestion
  const want = {
    sessionId: 'session_01TEST',
    title: 'Which checks should run?',
    options: [{ label: 'Lint', default: true }, { label: 'Tests', detail: 'slow' }, { label: 'Abandon the plan', stop: true }],
    multi: true,
  }
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  multi/default/stop reach the daemon as posted  (got=${JSON.stringify(got)})`)
  dom.window.close()
}

// ---------------------------------------------------------------------------
// The mirror (#1225): one entry per conversation turn, keyed by the page's own position, with the
// kind mapped to a role and markers left out. The opening turn is the run's prompt, and the only
// turn long enough to be cut — from its end, never the conversation's.

function mirrorOf(body) {
  const dom = new JSDOM(`<!doctype html><html><body><main>${body}</main></body></html>`, {
    url: 'https://claude.ai/code/session_01TEST',
    runScripts: 'outside-only',
  })
  dom.window.eval(script)
  const panel = [...dom.window.document.documentElement.children].filter(el => el.tagName === 'DIV').map(el => el.textContent).join(' ')
  const got = dom.window.__tfBridgeTranscript
  dom.window.close()
  return { got, panel }
}

{
  const prompt = 'prompt '.repeat(2000) // 14000 characters: only the opening turn is ever this long
  const { got } = mirrorOf(
    feed(
      row('human', 0, `<p>${prompt}</p>`),
      row('marker', 1, 'Initialized session'),
      row('assistant', 2, '<p>Looking at the repo.</p>\n<p>  \uE001 Copy  </p>'),
      row('human', 3, 'do the next one'),
      row('assistant', 4, 'On it'),
    ) + '<div contenteditable="true"></div>',
  )
  const want = [
    { seq: 0, role: 'user', text: prompt.trim().slice(0, 8000) },
    { seq: 2, role: 'agent', text: 'Looking at the repo.\nCopy' },
    { seq: 3, role: 'user', text: 'do the next one' },
    { seq: 4, role: 'agent', text: 'On it' },
  ]
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  mirror is one entry per turn, roles mapped, markers skipped, prompt head-capped  (turns=${got?.length}, seqs=${got?.map(e => e.seq).join(',')}, roles=${got?.map(e => e.role).join(',')})`)
}

{
  // A virtual list keeps only the tail rendered: positions come from the page, not from DOM order.
  const { got } = mirrorOf(feed(row('human', 7, 'later question'), row('assistant', 8, 'later answer')) + '<div contenteditable="true"></div>')
  const ok = JSON.stringify(got?.map(e => [e.seq, e.role])) === JSON.stringify([[7, 'user'], [8, 'agent']])
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  mirror keeps the page's positions when only the tail is rendered  (got=${JSON.stringify(got?.map(e => e.seq))})`)
}

{
  // A layout the mirror does not know is named, never mirrored as whatever text is on screen.
  const { got, panel } = mirrorOf('<div>Home Code Artifacts</div><p>some conversation text</p><div contenteditable="true"></div>')
  const ok = Array.isArray(got) && got.length === 0 && /no transcript rows found/.test(panel)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  no turn rows means nothing mirrored and the panel says so  (entries=${got?.length}, named=${/no transcript rows found/.test(panel)})`)
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

// ---------------------------------------------------------------------------
// Creating a session (#1328): the new-session page's repo chip opens a searchable list, a branch
// chip appears beside the chosen repo, the prompt goes into the composer, send turns the page
// into a session URL. The synthetic page behaves the way the live one was observed to, and what
// these prove is the flow around it: the right chip is opened, the branch is verified before
// anything is sent, and a page that cannot be driven says which control it lacked.

function newSessionPage({ branches = ['main', 'cloud-1-abcd'], remembered = 'the-framework', repoPicker = true } = {}) {
  // Mirrors the live page as observed 2026-08-24: chips are combobox buttons in the order repo,
  // branch, add; a picker is a dialog holding a search input (role combobox) and a listbox of
  // options; a closed picker's options stay in the DOM.
  const dom = new JSDOM(
    `<!doctype html><html><body><main>
      <button id="env">Default</button>
      ${remembered ? `<button role="combobox" id="repo">${remembered}</button><button role="combobox" id="branch">main</button>` : repoPicker ? '<button id="select">+ Select repo…</button>' : ''}
      <button role="combobox" aria-label="Add repository"></button>
      <div contenteditable="true"></div>
      <button aria-label="Send message" id="send"></button>
    </main></body></html>`,
    { url: 'https://claude.ai/code', runScripts: 'outside-only' },
  )
  const w = dom.window
  const d = w.document
  const seen = { sent: false, searched: [] }
  const openList = (placeholder, entries, onPick) => {
    const dialog = d.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.innerHTML = `<input role="combobox" placeholder="${placeholder}"/><div role="listbox">${entries.map(e => `<div role="option">${e}</div>`).join('')}</div>`
    dialog.querySelector('input').addEventListener('input', e => seen.searched.push(e.target.value))
    for (const opt of dialog.querySelectorAll('[role="option"]')) opt.addEventListener('click', () => { dialog.remove(); onPick(opt.textContent) })
    d.body.append(dialog)
  }
  const ensureBranchChip = () => {
    let chip = d.getElementById('branch')
    if (!chip) {
      chip = d.createElement('button')
      chip.setAttribute('role', 'combobox')
      chip.id = 'branch'
      chip.textContent = 'main'
      d.getElementById('repo').after(chip)
    }
    chip.onclick = () => openList('Search branches…', branches, b => { chip.textContent = b })
  }
  const wireRepo = chip => {
    chip.onclick = () => openList('Search repos…', ['brillout/docpress', 'framework/the-framework'], picked => {
      chip.textContent = picked.split('/').pop()
      chip.setAttribute('role', 'combobox')
      chip.id = 'repo'
      ensureBranchChip()
    })
  }
  if (d.getElementById('repo')) { wireRepo(d.getElementById('repo')); ensureBranchChip() }
  if (d.getElementById('select')) wireRepo(d.getElementById('select'))
  d.getElementById('send').addEventListener('click', () => {
    seen.sent = true
    w.history.pushState({}, '', '/code/session_01NEW')
  })
  w.__tfComposerWaitMs = 1000
  w.__tfMenuSettleMs = 10
  w.__tfSessionWaitMs = 2000
  w.eval(script)
  return { dom, w, d, seen }
}

const START = { repo: 'framework/the-framework', branch: 'cloud-1-abcd', prompt: 'Add the thing' }

{
  // The page remembered our repo: nothing to pick but the branch.
  const { dom, w, d, seen } = newSessionPage()
  const result = await w.__tfBridgeCreateSession(START)
  const branch = d.getElementById('branch')?.textContent
  const text = d.querySelector('[contenteditable="true"]').textContent
  const ok = result.ok && result.sessionId === 'session_01NEW' && /repo already the-framework/.test(result.note) && branch === 'cloud-1-abcd' && text === 'Add the thing' && seen.sent && seen.searched.includes('cloud-1-abcd')
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  create with the repo remembered picks the branch, types the prompt and sends  (branch=${branch}, searched=${JSON.stringify(seen.searched)}, result=${JSON.stringify(result)})`)
  dom.window.close()
}

{
  // The page remembered another repo: its chip is the picker.
  const { dom, w, d, seen } = newSessionPage({ remembered: 'docpress' })
  const result = await w.__tfBridgeCreateSession(START)
  const repo = d.getElementById('repo')?.textContent
  const branch = d.getElementById('branch')?.textContent
  const ok = result.ok && repo === 'the-framework' && branch === 'cloud-1-abcd' && seen.sent && /repo: clicked "framework\/the-framework"/.test(result.note)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  create with another repo remembered re-picks it through its chip  (repo=${repo}, branch=${branch}, result=${JSON.stringify(result)})`)
  dom.window.close()
}

{
  // Nothing remembered: the bare "Select repo" trigger.
  const { dom, w, d, seen } = newSessionPage({ remembered: '' })
  const result = await w.__tfBridgeCreateSession(START)
  const repo = d.getElementById('repo')?.textContent
  const ok = result.ok && repo === 'the-framework' && seen.sent
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  create with no repo remembered uses the select-repo trigger  (repo=${repo}, result=${JSON.stringify(result)})`)
  dom.window.close()
}

{
  // The branch list does not offer the pushed ref: nothing is sent, and the note says so.
  const { dom, w, seen } = newSessionPage({ branches: ['main', 'develop'] })
  const result = await w.__tfBridgeCreateSession(START)
  const ok = !result.ok && /branch/.test(result.note) && !seen.sent
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  create refuses to send on the wrong branch  (sent=${seen.sent}, note=${JSON.stringify(result.note)})`)
  dom.window.close()
}

{
  const { dom, w, seen } = newSessionPage({ remembered: '', repoPicker: false })
  const result = await w.__tfBridgeCreateSession(START)
  const ok = !result.ok && /no repo picker/.test(result.note) && !seen.sent
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  create names the missing control  (note=${result.note.slice(0, 80)}…)`)
  const probe = w.__tfBridgeProbeNewSession()
  const probeOk = probe.composer === 'contenteditable' && probe.sendButton === true && probe.triggers.some(t => t.text === 'Default')
  if (!probeOk) failed++
  console.log(`${probeOk ? 'PASS' : 'FAIL'}  probe describes the page without touching it  (${JSON.stringify(probe.triggers)})`)
  dom.window.close()
}

console.log(failed ? `\n${failed} case(s) failed` : '\nall cases passed')
process.exit(failed ? 1 : 0)
