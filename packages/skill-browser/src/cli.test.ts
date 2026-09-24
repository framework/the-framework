import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { appendFile, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveChromePath } from './chrome.js'
import { runCli, stateFile } from './cli.js'
import { absoluteUrl } from './page.js'
import { inputCalls } from './screen.js'

const chrome = resolveChromePath()
const needsChrome = chrome ? {} : { skip: 'no Chrome on this machine' }

const PAGES: Record<string, string> = {
  '/': `<!doctype html><title>Form</title>
    <p id="out">nothing yet</p>
    <input id="name" placeholder="Your name">
    <select aria-label="Colour"><option>Red</option><option>Blue</option></select>
    <button onclick="document.getElementById('out').textContent = 'Saved ' + document.getElementById('name').value + ' ' + document.querySelector('select').value">Save</button>
    <a href="/two">Page two</a>
    <form onsubmit="event.preventDefault(); document.getElementById('out').textContent = 'Submitted'"><input placeholder="search"></form>`,
  '/two': '<!doctype html><title>Two</title><p>Second page</p>',
  '/dialog': `<!doctype html><title>Dialog</title><p id="out">waiting</p>
    <button onclick="alert('hello'); document.getElementById('out').textContent = confirm('sure?') ? 'confirmed' : 'refused'">Ask</button>`,
}

async function site(): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    const page = PAGES[req.url ?? '']
    res.writeHead(page ? 200 : 404, { 'content-type': 'text/html' }).end(page ?? 'not found')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server }
}

/** A run of the command in a fresh project, with a diary the way a run's tool hands it over. */
async function project(): Promise<{ cwd: string; diary: string; cli: (...argv: string[]) => Promise<{ code: number; out: string; err: string }> }> {
  const cwd = await mkdtemp(join(tmpdir(), 'skill-browser-test-'))
  const diary = join(cwd, 'diary.jsonl')
  await writeFile(diary, '')
  const cli = async (...argv: string[]) => {
    const out: string[] = []
    const err: string[] = []
    const code = await runCli(argv, { cwd, env: { ...process.env, AGENT_DIARY: diary }, stdout: l => out.push(l), stderr: l => err.push(l) })
    return { code, out: out.join('\n'), err: err.join('\n') }
  }
  return { cwd, diary, cli }
}

async function lines(diary: string): Promise<Record<string, unknown>[]> {
  return (await readFile(diary, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>)
}

async function until(check: () => Promise<boolean>, ms = 10_000): Promise<boolean> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await check()) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

const gone = (path: string) => stat(path).then(() => false, () => true)

test('the agent opens a page, reads it, types, picks, clicks and presses; the chat gets a screen; close ends it all', needsChrome, async () => {
  const { url, server } = await site()
  const { cwd, diary, cli } = await project()
  try {
    const opened = await cli('open', url)
    assert.equal(opened.code, 0, opened.err)
    assert.match(opened.out, /^Title: Form$/m)
    assert.match(opened.out, /\[1\] input "Your name" value=""/)
    assert.match(opened.out, /\[2\] select "Colour" value="Red"/)
    assert.match(opened.out, /\[4\] link "Page two" -> \/two/)

    assert.match((await cli('type', '1', 'Ada')).out, /\[1\] input "Your name" value="Ada"/)
    assert.match((await cli('type', '2', 'Blue')).out, /value="Blue"/)
    assert.match((await cli('click', '3')).out, /Saved Ada Blue/)
    await cli('type', '5', 'hello')
    assert.match((await cli('press', 'Enter')).out, /Submitted/)
    assert.equal((await cli('eval', 'document.title')).out, '"Form"')
    const shot = await cli('screenshot', 'shot.png')
    assert.equal(shot.out, join(cwd, 'shot.png'))
    assert.deepEqual([...(await readFile(join(cwd, 'shot.png'))).subarray(1, 4)], [...Buffer.from('PNG')])
    assert.match((await cli('click', '4')).out, /Second page/)

    const [screen] = await lines(diary)
    assert.equal(screen?.['kind'], 'screen')
    assert.equal(screen?.['label'], `browser · ${url}/`)
    const view = String(screen?.['url'])
    assert.match(await (await fetch(view)).text(), /<title>browser<\/title>/)
    assert.equal((await fetch(view.replace(/\?t=.*/, ''))).status, 403, 'no token, no screen')

    assert.equal((await cli('close')).code, 0)
    assert.ok(await until(() => gone(stateFile(cwd))), 'the state file goes with the browser')
    assert.deepEqual((await lines(diary)).at(-1), { kind: 'screen', url: view, label: 'browser · closed', ended: true })
    const after = await cli('read')
    assert.equal(after.code, 1)
    assert.match(after.err, /No browser is open/)
  } finally {
    await cli('close')
    server.close()
  }
})

test('the run ending closes its browser, and the ended run gets no more lines', needsChrome, async () => {
  const { url, server } = await site()
  const { cwd, diary, cli } = await project()
  try {
    assert.equal((await cli('open', url)).code, 0)
    await appendFile(diary, JSON.stringify({ kind: 'ended', status: 'done' }) + '\n')
    assert.ok(await until(() => gone(stateFile(cwd))), 'the browser closes once the diary says the run ended')
    assert.equal((await lines(diary)).at(-1)?.['kind'], 'ended')
  } finally {
    await cli('close')
    server.close()
  }
})

test('a dialog never blocks the page: it is accepted and named; wrong input is refused in words', needsChrome, async () => {
  const { url, server } = await site()
  const { cli } = await project()
  try {
    await cli('open', `${url}/dialog`)
    const asked = await cli('click', '1')
    assert.equal(asked.code, 0, asked.err)
    assert.match(asked.out, /^Dialog, accepted: alert "hello"\nDialog, accepted: confirm "sure\?"\n/)
    assert.match(asked.out, /confirmed/)
    const typed = await cli('type', '1', 'x')
    assert.equal(typed.code, 1)
    assert.match(typed.err, /takes no text: click it instead/)
    assert.equal((await cli('eval', '1/0')).out, 'Infinity')
    const shot = await cli('screenshot', '/nonexistent-dir/shot.png')
    assert.equal(shot.code, 1)
    assert.match(shot.err, /could not be saved/)
  } finally {
    await cli('close')
    server.close()
  }
})

test('two opens at once start one browser', needsChrome, async () => {
  const { url, server } = await site()
  const { diary, cli } = await project()
  try {
    const [a, b] = await Promise.all([cli('open', url), cli('open', `${url}/two`)])
    assert.equal(a.code, 0, a.err)
    assert.equal(b.code, 0, b.err)
    const screens = new Set((await lines(diary)).map(line => line['url']))
    assert.equal(screens.size, 1, 'both opens went to the same browser')
  } finally {
    await cli('close')
    server.close()
  }
})

test('a command before open refuses; a wrong command line is a usage error', async () => {
  const { cli } = await project()
  const read = await cli('read')
  assert.equal(read.code, 1)
  assert.match(read.err, /browser open <address>/)
  assert.equal((await cli('click')).code, 2)
  assert.equal((await cli('fly', 'away')).code, 2)
})

test('an address without a scheme is http; other schemes are refused', () => {
  assert.equal(absoluteUrl('localhost:3000/a'), 'http://localhost:3000/a')
  assert.equal(absoluteUrl('https://example.com'), 'https://example.com')
  assert.throws(() => absoluteUrl('file:///etc/passwd'), /only http and https/)
  assert.throws(() => absoluteUrl('javascript:alert(1)'), /only http and https/)
})

test('the screen passes on only input it knows', () => {
  assert.equal(inputCalls({ type: 'click', x: 1, y: 2 }).length, 2)
  assert.deepEqual(inputCalls({ type: 'click', x: Number.NaN, y: 2 }), [])
  assert.deepEqual(inputCalls({ type: 'navigate', url: 'file:///etc/passwd' }), [])
  assert.deepEqual(inputCalls({ type: 'key', key: 'F13' }), [])
  assert.deepEqual(inputCalls({ type: 'text', text: '' }), [])
  assert.deepEqual(inputCalls({ type: 'bogus' } as never), [])
})
