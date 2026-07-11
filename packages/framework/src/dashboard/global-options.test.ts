import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { dashboardHtml } from './page.js'

// The Global options panel (#314) is client-side JS baked into the page: a set of
// persistent run toggles (Autopilot / Technical / Vanilla / Eco + sub-toggles)
// saved in localStorage and sent with each Start. These drive the real page in
// jsdom, so we assert behavior, not just that the code ships.

interface Started {
  prompt: string
  kind: string
  options: Record<string, unknown>
}

interface Harness {
  doc: Document
  window: Record<string, unknown>
  started: Started[]
  check: (id: string) => void
  isChecked: (id: string) => boolean
  el: (id: string) => HTMLElement
}

// Boot the startable dashboard page in jsdom, seeding localStorage first so
// init-from-storage is observable. `fetch` to api/start records the posted body.
function boot(seed: Record<string, string> = {}): Harness {
  const started: Started[] = []
  const dom = new JSDOM(dashboardHtml('Test', true, true, true), {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(window) {
      const w = window as unknown as { [k: string]: unknown }
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v)
      w['setInterval'] = () => 0
      w['setTimeout'] = () => 0
      w['EventSource'] = class {
        onmessage: ((ev: { data: string }) => void) | null = null
        onerror: (() => void) | null = null
        close() {}
      }
      w['fetch'] = (url: string, opts?: { method?: string; body?: string }) => {
        if (url === 'api/start' && opts?.body) started.push(JSON.parse(opts.body) as Started)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ runs: [], docs: [] }) })
      }
    },
  })
  const window = dom.window as unknown as { [k: string]: unknown }
  const doc = dom.window.document
  const el = (id: string): HTMLElement => {
    const node = doc.getElementById(id)
    assert.ok(node, `#${id} exists`)
    return node as HTMLElement
  }
  return {
    doc,
    window,
    started,
    el,
    isChecked: id => (el(id) as HTMLInputElement).checked,
    check(id) {
      const input = el(id) as HTMLInputElement
      input.checked = !input.checked
      input.dispatchEvent(new dom.window.Event('change'))
    },
  }
}

// Type a prompt and press Start, returning the options that would be POSTed.
function start(h: Harness, prompt = 'build a blog'): Record<string, unknown> {
  ;(h.el('start-prompt') as HTMLTextAreaElement).value = prompt
  ;(h.el('start-run') as unknown as { click: () => void }).click()
  assert.equal(h.started.length, 1, 'one start was posted')
  return h.started[0]!.options
}

test('the panel ships in the startable page with all Global option toggles (#314)', () => {
  const h = boot()
  for (const id of ['opt-autopilot', 'opt-technical', 'opt-vanilla', 'opt-eco', 'opt-eco-planning', 'opt-eco-research', 'opt-eco-maintenance'])
    assert.ok(h.doc.getElementById(id), `#${id} exists`)
})

test('defaults: Autopilot on, the rest off, Eco sub-toggles hidden (#314)', () => {
  const h = boot()
  assert.equal(h.isChecked('opt-autopilot'), true) // framework:autopilot defaults on
  assert.equal(h.isChecked('opt-technical'), false)
  assert.equal(h.isChecked('opt-vanilla'), false)
  assert.equal(h.isChecked('opt-eco'), false)
  assert.equal(h.el('eco-subs').hidden, true)
})

test('toggles initialize from localStorage (#314)', () => {
  const h = boot({
    'framework:autopilot': '0',
    'framework:opt:technical': '1',
    'framework:opt:eco': '1',
    'framework:opt:eco-research': '1',
  })
  assert.equal(h.isChecked('opt-autopilot'), false)
  assert.equal(h.isChecked('opt-technical'), true)
  assert.equal(h.isChecked('opt-eco'), true)
  assert.equal(h.isChecked('opt-eco-research'), true)
  // Eco is on, so the sub-toggles are revealed.
  assert.equal(h.el('eco-subs').hidden, false)
})

test('toggling a Global option persists it to localStorage (#314)', () => {
  const h = boot()
  h.check('opt-technical')
  assert.equal(h.window['localStorage'] && (h.el('opt-technical') as HTMLInputElement).checked, true)
  assert.equal((h.window as { localStorage: Storage }).localStorage.getItem('framework:opt:technical'), '1')
})

test('Eco reveals its sub-toggles; Vanilla disables Eco entirely (#314)', () => {
  const h = boot()
  h.check('opt-eco')
  assert.equal(h.el('eco-subs').hidden, false)
  // Turning Vanilla on removes the whole built-in prompt: Eco is disabled and its
  // sub-toggles hidden (nothing left to trim).
  h.check('opt-vanilla')
  assert.equal((h.el('opt-eco') as HTMLInputElement).disabled, true)
  assert.equal(h.el('eco-subs').hidden, true)
})

test('Start posts the enabled options; a plain default start sends autopilot only (#314)', () => {
  const h = boot()
  const options = start(h)
  assert.deepEqual(options, { autopilot: true }) // autopilot default-on, nothing else
})

test('Start posts vanilla + technical + the enabled Eco drops (#314)', () => {
  const h = boot()
  h.check('opt-autopilot') // turn the default-on autopilot off
  h.check('opt-technical')
  h.check('opt-eco')
  h.check('opt-eco-planning')
  h.check('opt-eco-maintenance')
  const options = start(h)
  assert.deepEqual(options, {
    technical: true,
    eco: { autoPlanning: true, autoMaintenance: true },
  })
})

test('Eco off drops the eco object even when sub-toggles were checked (#314)', () => {
  const h = boot({ 'framework:opt:eco': '1', 'framework:opt:eco-research': '1' })
  h.check('opt-eco') // turn Eco off; the sub-toggle stays stored but is not sent
  const options = start(h)
  assert.equal('eco' in options, false)
})

test('Autopilot stays in lockstep with the choice-panel toggle (#314)', () => {
  const h = boot()
  // The global Autopilot and the choice-panel Autopilot share framework:autopilot.
  h.check('opt-autopilot') // -> off
  assert.equal((h.window as { localStorage: Storage }).localStorage.getItem('framework:autopilot'), '0')
  assert.equal(h.isChecked('autopilot-toggle'), false)
  h.check('opt-autopilot') // -> on
  assert.equal(h.isChecked('autopilot-toggle'), true)
})
