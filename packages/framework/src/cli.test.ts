import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { appendControl } from './control.js'
import { BROWSER_MCP_SERVERS, withBrowser } from './browser.js'
import { EVENTS_FILE, FRAMEWORK_DIR, ARCHIVE_DIR, type StoreFs } from './store/index.js'
import { layoutMarker, layoutMarkerPath } from './layout.js'
import { nodeGitRunner } from './project.js'
import {
  chooseSessionLink,
  claudeDriverOptions,
  CLAUDE_CODE_SESSION_LIST,
  createAgentJournal,
  frameworkVersion,
  mergeAgentConfig,
  parseArgs,
  printStartupFooter,
  promptAgentSpec,
  runCli,
  agentLogKind,
  runOnBeforeMergeable,
  agentOptions,
  unguardedNotices,
  type CliIO,
  type AgentOptions,
  isSteerable,
  isInteractive,
} from './cli.js'
import { writeAgentSpec, type AgentSpec } from './agent-spec.js'
import { createDriver } from './driver-cli.js'
import { FakeDriver } from './driver/index.js'
import type { FrameworkEvent } from './events.js'

function capture(): { io: CliIO; out: string[]; err: string[] } {
  const out: string[] = []
  const err: string[] = []
  return { io: { out: l => out.push(l), err: l => err.push(l) }, out, err }
}

/** A session spec with the fields a test does not care about filled in (D4). */
function spec(fields: Partial<AgentSpec> = {}): AgentSpec {
  return { prompt: 'x', kind: 'build', cwd: '/work/app', options: {}, ...fields }
}

/** A session's resolved options, straight off a spec — the shape `parseArgs` used to return. */
function opts(fields: Partial<AgentSpec> = {}): AgentOptions {
  return agentOptions(spec(fields))
}

/**
 * Run one session the way the dashboard does: write its spec, hand the path over as `--agent`.
 *
 * A caller that does not name a checkout gets a throwaway one, never `spec()`'s placeholder: this
 * actually runs, so the cwd has to be a directory the session may write into on any machine.
 *
 * `fake` rides `FRAMEWORK_FAKE` rather than the spec, because the offline driver is a property of
 * the *process*, not of the session: the e2e harness's own bin sets the same variable on itself
 * before forwarding to `runCli`. Set and restored around the call, which is safe because
 * `node --test` runs a file's tests one at a time.
 */
async function runAgentCli(fields: Partial<AgentSpec>, io: CliIO, fake = true): Promise<number> {
  const cwd = fields.cwd ?? (await mkdtemp(join(tmpdir(), 'framework-session-cwd-')))
  const path = await writeAgentSpec(spec({ ...fields, cwd }))
  const previous = process.env['FRAMEWORK_FAKE']
  if (fake) process.env['FRAMEWORK_FAKE'] = '1'
  else delete process.env['FRAMEWORK_FAKE']
  try {
    return await runCli(['--agent', path], io)
  } finally {
    if (previous === undefined) delete process.env['FRAMEWORK_FAKE']
    else process.env['FRAMEWORK_FAKE'] = previous
  }
}

/** An in-memory {@link StoreFs} so runOnBeforeMergeable's preset materialization never touches disk. */
function memFs(): StoreFs & { files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    files,
    async read(p) { const v = files.get(p); if (v === undefined) throw new Error(`ENOENT: ${p}`); return v },
    async write(p, c) { files.set(p, c) },
    async append(p, c) { files.set(p, (files.get(p) ?? '') + c) },
    async exists(p) { return files.has(p) },
    async mkdir() {},
    async readdir() { return [] },
  }
}

test('parseArgs keeps four options and no verbs (D4)', () => {
  assert.deepEqual(parseArgs([]), { help: false, version: false })
  assert.equal(parseArgs(['--help']).help, true)
  assert.equal(parseArgs(['-v']).version, true)
  assert.equal(parseArgs(['--port', '0']).port, 0)
  assert.equal(parseArgs(['--host', '0.0.0.0']).host, '0.0.0.0')
  assert.equal(parseArgs(['--agent', '/tmp/s.json']).session, '/tmp/s.json')
  // Every setting used to be a flag here. They travel as a session spec now, so both an unknown
  // option and a bare word — what used to be an intent or a verb — are usage errors.
  assert.match(parseArgs(['--autopilot']).error!, /unknown option/)
  assert.match(parseArgs(['a blog app']).error!, /unknown command/)
  assert.match(parseArgs(['--port', 'x']).error!, /--port/)
})

test('the session spec is what carries a session, and it round-trips through agentOptions (D4)', () => {
  const o = opts({ prompt: 'a blog app', kind: 'prompt', cwd: '/work/api', agentId: 'r1', continueAgent: true })
  assert.equal(o.intent, 'a blog app')
  assert.equal(o.cwd, '/work/api')
  assert.equal(o.agentId, 'r1')
  assert.equal(o.continueAgent, true)
  assert.equal(o.directPrompt, true)
  assert.equal(o.research, false)
})

test('the backlog loop runs unless the spec says otherwise (#323)', () => {
  assert.equal(opts().todoLoop, true)
  // Unattended (#846): off unless asked, so an ordinary agent still parks its gates for the human.
  assert.equal(opts().unattended, undefined)
  assert.equal(opts({ options: { unattended: true } }).unattended, true)
})

test('the in-context directories travel as a list (#439)', () => {
  assert.deepEqual(opts().context, [])
  assert.deepEqual(opts({ options: { context: ['/work/api', '/work/ui'] } }).context, ['/work/api', '/work/ui'])
})

test('the on-before-mergeable prompt is opt-in (#326)', () => {
  assert.equal(opts().onBeforeMergeable, false)
  assert.equal(opts({ options: { onBeforeMergeable: true } }).onBeforeMergeable, true)
})

test('the browser is opt-in (#452)', () => {
  assert.equal(opts().browser, false)
  assert.equal(opts({ options: { browser: true } }).browser, true)
})

test('the handoff resolves to the PR rung, which is what makes it zero-config (#1102)', () => {
  // Unlike most toggles, nobody saying anything means yes: a plain agent pushes its branch and
  // opens a draft PR when it finishes. A spec that says nothing leaves it unset, so the repo's
  // the-framework.yml can decide (#1173).
  assert.equal(opts().handoff, undefined)
  assert.equal(opts({ options: { handoff: 'local' } }).handoff, 'local')
  // A rung nobody defines is not a rung: a spec is not trusted input, it is a file on disk.
  assert.equal(opts({ options: { handoff: 'nonsense' as 'local' } }).handoff, undefined)
  assert.equal(mergeAgentConfig(opts(), {}).handoff, 'pr')
})

test('the-framework.yml can move the handoff, and the spec overrides the file (#1173)', () => {
  // Nearest layer wins, like every other yml key.
  const fromFile = mergeAgentConfig(opts(), { handoff: 'push' })
  assert.equal(fromFile.handoff, 'push')
  assert.equal(fromFile.sources.handoff, 'the-framework.yml')
  const overridden = mergeAgentConfig(opts({ options: { handoff: 'merge' } }), { handoff: 'push' })
  assert.equal(overridden.handoff, 'merge')
  assert.equal(overridden.sources.handoff, 'flag')
  assert.equal(mergeAgentConfig(opts(), { handoff: 'local' }).handoff, 'local')
})

test('the spec carries the agent session a follow-up continues (#720)', () => {
  assert.equal(opts().resumeSession, undefined)
  assert.equal(opts({ kind: 'prompt', options: { resumeSession: 'sess-42' } }).resumeSession, 'sess-42')
  assert.equal(opts({ options: { resumeSession: '  sess-7  ' } }).resumeSession, 'sess-7') // trimmed
  assert.equal(opts({ options: { resumeSession: '   ' } }).resumeSession, undefined) // blank says nothing
})

test('withBrowser folds chrome-devtools-mcp into driver options only when enabled (#452)', () => {
  const base = claudeDriverOptions()
  assert.equal(withBrowser(base, false).mcpServers, undefined)
  const withIt = withBrowser(base, true)
  assert.deepEqual(withIt.mcpServers, BROWSER_MCP_SERVERS)
  // Non-mutating: the base options are untouched.
  assert.equal(base.mcpServers, undefined)
})

test('promptAgentSpec runs a headless prompt and carries NO onBeforeMergeable (recursion guard, #326)', () => {
  assert.deepEqual(promptAgentSpec('audit this', '/work/app'), {
    prompt: 'audit this',
    kind: 'prompt',
    cwd: '/work/app',
    options: {},
  })
})

test('promptAgentSpec goes vanilla so the on-before-mergeable follow-up skips the session-name branch step (#560)', () => {
  // The follow-up is not a session; vanilla drops the built-in system prompt (#326) (and its `### Session
  // name` step), so the agent stays on the session branch instead of stranding its output.
  assert.equal(promptAgentSpec('queue follow-ups', '/work/app', true).options.vanilla, true)
})

test('runOnBeforeMergeable queues the follow-ups in ONE run instead of running the presets (#326/#556)', async () => {
  const { io } = capture()
  const seen: string[] = []
  const agent = (prompt: string) => {
    seen.push(prompt)
    return Promise.resolve(true)
  }
  await runOnBeforeMergeable('/work/app', '/bin/framework', io, { session_name: 'add-oauth' }, agent, memFs())
  // One child run, not three: it asks for TODO entries rather than doing the passes.
  assert.equal(seen.length, 1)
  const prompt = seen[0]!
  assert.match(prompt, /add the following to <TODO_FILE>/)
  assert.match(prompt, /Apply \.the-framework\/presets\/maintainability\.md with tf\.params\.what set to "changes introduced by add-oauth"/)
  assert.match(prompt, /Apply \.the-framework\/presets\/security_audit\.md with tf\.params\.what set to "changes introduced by add-oauth"/)
  // The preset prompts themselves are not what gets sent any more.
  assert.doesNotMatch(prompt, /easy as possible for humans to read/)
  assert.ok(!prompt.includes('${{'), 'fully rendered')
})

test('runOnBeforeMergeable is best-effort: a failed queueing run is reported, never thrown (#326)', async () => {
  const { io, out } = capture()
  await runOnBeforeMergeable('/work/app', '/bin/framework', io, { session_name: 'add-oauth' }, () => Promise.resolve(false), memFs())
  assert.ok(out.some(l => /on-before-mergeable queueing did not complete/.test(l)))
})

test('runOnBeforeMergeable materializes the presets so the queued filePaths resolve (#598)', async () => {
  const { io } = capture()
  const fs = memFs()
  await runOnBeforeMergeable('/work/app', '/bin/framework', io, { session_name: 'add-oauth' }, () => Promise.resolve(true), fs)
  // The entry points at .the-framework/presets/maintainability.md; that file must now exist.
  assert.ok(fs.files.has(join('/work/app', '.the-framework/presets/maintainability.md')))
  assert.ok(fs.files.has(join('/work/app', '.the-framework/presets/security_audit.md')))
})

test('the ticket a session implements is re-checked, since it comes off a file an agent wrote (#1117)', () => {
  assert.equal(opts({ options: { ticket: 'tickets/2026-07-25_login.md' } }).ticket, 'tickets/2026-07-25_login.md')
  assert.equal(opts().ticket, undefined) // nothing said = no particular ticket
  for (const bad of ['tickets/../etc/passwd', '/etc/passwd', 'TODO_AGENTS.md', '']) {
    assert.equal(opts({ options: { ticket: bad } }).ticket, undefined, `expected ${bad} to be dropped`)
  }
  // A planning agent says so (#1327): it is what keeps its PR title from inheriting the ticket's
  // issue as `(fix #42)` and closing it with the work still undone.
  assert.equal(opts({ options: { planAgent: true } }).planAgent, true)
})

test('transparent is unset by default (#625)', () => {
  assert.equal(opts().transparent, undefined) // unset, so the repo file decides (#841)
  assert.equal(opts({ options: { transparent: true } }).transparent, true)
  // Unset resolves to off, so a session with nothing said and no file is still a normal one.
  assert.equal(mergeAgentConfig(opts(), {}).transparent, false)
})

test('the built-in prompt is off for a vanilla session or the-framework.yml vanilla:true (#314/C3)', () => {
  // One name and one polarity across the session, the file and the agent option (C3). The file used
  // to spell this `antiLazyPill` — and the other way round — so every layer boundary was also an
  // inversion, which is what three apologising comments were for.
  assert.equal(mergeAgentConfig(opts(), {}).vanilla, false)
  assert.equal(mergeAgentConfig(opts({ options: { vanilla: true } }), {}).vanilla, true)
  assert.equal(mergeAgentConfig(opts(), { vanilla: true }).vanilla, true)
  // #841: an explicit `vanilla: false` puts the prompt back over a file that removed it.
  assert.equal(mergeAgentConfig(opts({ options: { vanilla: false } }), { vanilla: true }).vanilla, false)
})

test('agentLogKind maps the run path to the flow recorded on the meta (#379/#1467)', () => {
  assert.equal(agentLogKind({ directPrompt: false, research: false }), 'build')
  assert.equal(agentLogKind({ directPrompt: true, research: false }), 'prompt')
  assert.equal(agentLogKind({ directPrompt: false, research: true }), 'prompt')
  // Transparent (#625) routes a build-kind agent through the raw prompt path, so it records as one.
  assert.equal(agentLogKind({ directPrompt: false, research: false }, true), 'prompt')
})

test('the spec kind picks the path: research, verbatim prompt, or build (#331/#353)', () => {
  const bare = opts({ kind: 'research', prompt: '' })
  assert.equal(bare.research, true)
  assert.equal(bare.intent, '') // the "what" defaults downstream (this PR)
  assert.equal(opts({ kind: 'research', prompt: 'the auth flow' }).intent, 'the auth flow')
  const verbatim = opts({ kind: 'prompt', prompt: 'review the auth flow' })
  assert.equal(verbatim.directPrompt, true)
  assert.equal(verbatim.intent, 'review the auth flow')
  const build = opts({ kind: 'build', prompt: 'a blog' })
  assert.equal(build.research, false)
  assert.equal(build.directPrompt, false)
})

test('frameworkVersion reports the real package version, not the failed-read placeholder (#312)', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  assert.equal(frameworkVersion(), pkg.version)
  // The guard this test exists for: a failed read must not look like a plausible version. The
  // sentinel is `unknown` rather than `0.0.0` because the packages are unreleased and genuinely
  // versioned `0.0.0`, so a numeric fallback would be indistinguishable from a correct read.
  assert.notEqual(frameworkVersion(), 'unknown')
})

test('runCli --version prints the real version (#312)', async () => {
  const { io, out } = capture()
  const code = await runCli(['--version'], io)
  assert.equal(code, 0)
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  assert.deepEqual(out, [pkg.version])
})

test('runCli errors on a session spec with nothing to run (#353)', async () => {
  const { io, err } = capture()
  const code = await runAgentCli({ prompt: '', kind: 'prompt' }, io, false)
  assert.equal(code, 2)
  assert.ok(err.some(l => /no prompt to run/.test(l)))
})

test('runCli refuses a session whose repo records another layout, before writing anything (#1575)', async () => {
  // The stale-published-build case: the repo's tracked marker says `sessions`, this build says
  // `agents` — the session is refused outright rather than committing wrong-layout bookkeeping.
  const { io, err } = capture()
  const cwd = await mkdtemp(join(tmpdir(), 'framework-layout-skew-'))
  await mkdir(join(cwd, '.the-framework'), { recursive: true })
  await writeFile(layoutMarkerPath(cwd), layoutMarker().replace('archive-dir: agents', 'archive-dir: sessions'))
  const code = await runAgentCli({ prompt: 'say hi', kind: 'prompt', cwd }, io)
  assert.equal(code, 1)
  assert.ok(err.some(l => /#1575/.test(l)))
})

test('runCli refuses a session spec it cannot read, rather than running something else (D4)', async () => {
  const { io, err } = capture()
  assert.equal(await runCli(['--agent', join(tmpdir(), 'framework-no-such-spec.json')], io), 2)
  assert.ok(err.some(l => /could not read the session spec/.test(l)))
})

test('runCli prompt runs the text through the direct path (#353)', async () => {
  const { io, out } = capture()
  const code = await runAgentCli({ prompt: 'say hi', kind: 'prompt' }, io)
  assert.equal(code, 0)
  assert.ok(out.some(l => /prompt session done/.test(l)))
})

test('parseArgs flags unknown options and bad values', () => {
  assert.match(parseArgs(['--nope']).error!, /unknown option/)
  assert.match(parseArgs(['--port', '-1']).error!, /--port/)
  assert.match(parseArgs(['--port']).error!, /--port/)
  assert.match(parseArgs(['--host']).error!, /--host/)
  assert.match(parseArgs(['--agent']).error!, /--agent/)
  // Every settings flag that used to be validated here is gone with the flag tier (D4). The
  // dashboard is the only writer of a spec, so an invalid combination is never constructed.
  for (const gone of ['--scope', '--max-passes', '--max-cost', '--permission-mode', '--driver', '--run-on']) {
    assert.match(parseArgs([gone]).error!, /unknown option/, gone)
  }
})

test('the driver defaults to claude, and an unknown one is ignored rather than trusted (#542)', () => {
  assert.equal(opts().driver, 'claude')
  assert.equal(opts({ options: { driver: 'codex' } }).driver, 'codex')
  assert.equal(opts({ options: { driver: 'nonesuch' } }).driver, 'claude')
})

test('the run target is absent by default (#1050)', () => {
  assert.equal(opts().target, undefined)
  assert.equal(opts({ options: { target: 'local' } }).target, 'local')
  assert.equal(opts({ options: { target: 'actions' } }).target, 'actions')
})

test('createDriver builds the implementation the picked driver names (#542)', () => {
  assert.equal(createDriver({ driver: 'claude' }).id, 'claude-code')
  assert.equal(createDriver({ driver: 'codex' }).id, 'codex')
})

test('unguardedNotices is silent when the settings really do apply (#542)', () => {
  assert.deepEqual(unguardedNotices({ driver: 'claude', browser: true }), [])
  assert.deepEqual(unguardedNotices({ driver: 'codex', browser: false }), [])
})

test('unguardedNotices flags the Claude-only browser on another agent (#542)', () => {
  const notes = unguardedNotices({ driver: 'codex', browser: true })
  assert.equal(notes.length, 1)
  assert.match(notes[0]!, /browser has no effect/)
})

test('claudeDriverOptions runs the headless agent at bypassPermissions (#225)', () => {
  // acceptEdits would deny installs/builds/tests headlessly, so a session opts up. There is no
  // override any more: the two flags that offered one had no dashboard control (D4).
  assert.deepEqual(claudeDriverOptions(), { permissionMode: 'bypassPermissions' })
})

test('a session persists itself, and the modes stay unset until the spec names them (#211/#841)', () => {
  assert.equal(opts().persist, true)
  assert.equal(opts().vanilla, undefined)
  assert.equal(opts().transparent, undefined)
  const on = opts({ options: { vanilla: true, transparent: true } })
  assert.equal(on.vanilla, true)
  assert.equal(on.transparent, true)
})

test('mergeAgentConfig: the-framework.yml supplies defaults, flags override (#258)', () => {
  const flags = {}
  const modes = (config: { vanilla: boolean; transparent: boolean }) => [config.vanilla, config.transparent]
  // file-only: the repo config drives the agent
  assert.deepEqual(modes(mergeAgentConfig(flags, { transparent: true })), [false, true])
  // a mode set by either layer is on; the flag layer says nothing about the mode it did not set
  assert.deepEqual(modes(mergeAgentConfig({ vanilla: true }, { transparent: true })), [true, true])
  // nothing set anywhere: no modes
  assert.deepEqual(modes(mergeAgentConfig(flags, {})), [false, false])
})

test('mergeAgentConfig: a nearer layer can turn a mode off, not just on (#841)', () => {
  // The bug: with OR, a session could only ever enable. Now an explicit off beats a file that
  // enabled it — and with the spec that is a plain `false`, not a second `--no-*` spelling.
  assert.equal(mergeAgentConfig(opts({ options: { transparent: false } }), { transparent: true }).transparent, false)
  assert.equal(mergeAgentConfig(opts({ options: { vanilla: false } }), { vanilla: true }).vanilla, false)
  // And the file still supplies the value when this session says nothing.
  assert.equal(mergeAgentConfig(opts(), { transparent: true }).transparent, true)
  // The session still wins when it says "on" over a file that says "off".
  assert.equal(mergeAgentConfig(opts({ options: { transparent: true } }), { transparent: false }).transparent, true)
  // A layer that set nothing does not participate: absent stays absent, defaults hold.
  const bare = mergeAgentConfig(opts(), {})
  assert.deepEqual({ transparent: bare.transparent, vanilla: bare.vanilla }, { transparent: false, vanilla: false })
  assert.deepEqual(bare.sources, {})
})

test('runCli rejects a resumed agent session on a build run rather than dropping it (#782)', async () => {
  const { io, err } = capture()
  const code = await runAgentCli({ options: { resumeSession: 'sess-42' } }, io)
  assert.equal(code, 2)
  assert.ok(err.some(l => /only applies to a prompt session/.test(l)))
})

test('runCli honors a resumed agent session on the prompt path it belongs to (#782)', async () => {
  const { io, err } = capture()
  // The dashboard's continuation always runs here, so the guard must never fire on it.
  const code = await runAgentCli({ prompt: 'keep going', kind: 'prompt', options: { resumeSession: 'sess-42' } }, io)
  assert.notEqual(code, 2)
  assert.ok(!err.some(l => /only applies to a prompt session/.test(l)))
})

test('chooseSessionLink defaults a live run to the claude.ai/code session list (#212)', () => {
  assert.equal(chooseSessionLink({ driver: 'claude' }, false), CLAUDE_CODE_SESSION_LIST)
  assert.equal(CLAUDE_CODE_SESSION_LIST, 'https://claude.ai/code')
})

test('chooseSessionLink gives no link for a fake run (no real session)', () => {
  assert.equal(chooseSessionLink({ driver: 'claude' }, true), undefined)
})

test('chooseSessionLink does not point a non-Claude session at claude.ai (#542)', () => {
  assert.equal(chooseSessionLink({ driver: 'codex' }, false), undefined)
})

test('runCli --help prints usage and exits 0', async () => {
  const { io, out } = capture()
  const code = await runCli(['--help'], io)
  assert.equal(code, 0)
  assert.match(out.join('\n'), /Usage:/)
})

test('runCli usage error exits 2', async () => {
  const { io } = capture()
  assert.equal(await runCli(['--bogus'], io), 2)
})

// The CLI is foreground-only, so there is no `--daemon`, no `stop`, and no background dashboard
// for a bare `framework` to defer to. Bare `framework` binds a port and blocks until Ctrl-C, which
// is `runDaemon`'s own contract, covered in daemon.test.ts rather than here.
test('runCli rejects the retired flags and verbs as usage errors (D4/D4b)', async () => {
  // The verbs go with the flags: the dashboard is where a session, a doctor report and a worktree
  // cleanup are asked for, and Ctrl-C is how the foreground dashboard is stopped.
  for (const argv of [['--daemon'], ['--daemon-serve'], ['stop'], ['doctor'], ['maintain'], ['worktrees'], ['prompt', 'hi']]) {
    const { io } = capture()
    assert.equal(await runCli(argv, io), 2, `${argv.join(' ')} is not a command`)
  }
})

test('a session runs no preflight of its own: the dashboard already did (#1326)', async () => {
  const { io } = capture()
  // Nothing here probes for the agent CLI, so this succeeds regardless of what is installed —
  // which is the point: the dashboard refused the start if the agent could not run, and a
  // `--run-on actions` session needs no local agent at all.
  assert.equal(await runAgentCli({}, io), 0)
})

test('runCli runs a whole session offline', async () => {
  const { io, out } = capture()
  const code = await runAgentCli({ prompt: 'a blog' }, io)
  assert.equal(code, 0)
  const text = out.join('\n')
  assert.match(text, /▶ "a blog"/) // what it was asked for, said once as the session opens
  // #1372: nothing reviews the build, so there is no checklist pass — the build is the whole session.
  assert.doesNotMatch(text, /checklist pass/)
  assert.match(text, /\u2713 done/)
})

test('runCli --transparent runs a bare prompt raw, skipping the build flow + wrapping (#625/#678)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-transparent-'))
  try {
    const { io, out } = capture()
    const code = await runAgentCli({ prompt: 'make it blue', cwd: dir, options: { transparent: true } }, io)
    assert.equal(code, 0)
    const text = out.join('\n')
    // Transparent = raw Claude Code: the build path's markers must NOT appear (contrast the test above).
    assert.doesNotMatch(text, /scope: full/) // no scope phase
    assert.doesNotMatch(text, /production-grade/) // no synthesize / production-grade pass
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the dashboard steers a dashboard-less run through its gates via control.jsonl (#344)', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-ws-'))
  const cfg = await mkdtemp(join(tmpdir(), 'framework-cfg-'))
  const prevAwait = process.env.FRAMEWORK_FAKE_AWAIT
  const prevXdg = process.env.XDG_CONFIG_HOME
  process.env.FRAMEWORK_FAKE_AWAIT = 'choices' // the fake build stops to ask (#341)
  process.env.XDG_CONFIG_HOME = cfg
  try {
    await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })

    const { io, out } = capture()
    let settled = false
    // --run-id is what the dashboard passes when it spawns, and what makes this agent steerable
    // (#905): the dashboard drives the control file on the other end.
    const done = runAgentCli({ cwd, agentId: 'r-steer' }, io).finally(
      () => (settled = true),
    )

    // Play the daemon: tail events.jsonl for the build's parked await-choices gate and
    // answer it with its recommended pick, exactly as the daemon page's Accept button would.
    const answered = new Set<string>()
    const eventsPath = join(cwd, FRAMEWORK_DIR, EVENTS_FILE)
    for (let i = 0; i < 500 && !settled; i++) {
      const lines = await readFile(eventsPath, 'utf8').then(s => s.split('\n').filter(Boolean), () => [])
      for (const l of lines) {
        let e: { kind?: string; id?: string; recommended?: string; options?: { id: string }[] }
        try {
          e = JSON.parse(l)
        } catch {
          continue
        }
        if (e.kind !== 'choice' || !e.id || answered.has(e.id)) continue
        answered.add(e.id)
        await appendControl(cwd, { kind: 'choice', id: e.id, pick: e.recommended ?? e.options?.[0]?.id ?? '', by: 'user' })
      }
      // The steered build now stays open waiting for a chat message or Stop (#714). Once it has
      // been steered through its gate and produced its output, end it with a Stop, exactly as the
      // dashboard's Stop button would; otherwise `done` never resolves and the agent hangs.
      if (answered.has('await-choices') && /\u2713 done/.test(out.join('\n'))) {
        await appendControl(cwd, { kind: 'stop' })
        break
      }
      await new Promise(r => setTimeout(r, 20))
    }

    assert.equal(await done, 0)
    assert.ok(answered.has('await-choices'), 'the build await gate parked and was steered')
    assert.match(out.join('\n'), /\u2713 done/)
    // The resolution was attributed to the steering user, not a headless auto-accept.
    const resolved = (await readFile(eventsPath, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l))
      .filter((e: { kind: string }) => e.kind === 'choice-resolved')
    assert.equal(resolved.length, 1)
    assert.ok(resolved.every((e: { by: string }) => e.by === 'user'))
  } finally {
    if (prevAwait === undefined) delete process.env.FRAMEWORK_FAKE_AWAIT
    else process.env.FRAMEWORK_FAKE_AWAIT = prevAwait
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = prevXdg
    await rm(cwd, { recursive: true, force: true })
    await rm(cfg, { recursive: true, force: true })
  }
})

test('runOnBeforeMergeable reports how it went, so the caller can emit it (#835)', async () => {
  const { io } = capture()
  const fire = (ok: boolean) =>
    runOnBeforeMergeable('/work/app', '/bin/framework', io, { session_name: 'add-oauth' }, () => Promise.resolve(ok), memFs())
  assert.equal(await fire(true), 'queued')
  assert.equal(await fire(false), 'incomplete')
})

test('a declined post-merge cleanup lands in the archived event log, not on stdout (#835)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-obm-'))
  try {
    const { io } = capture()
    // A fake agent never signals ready-for-merge, so the step declines. The point is that the
    // decline is *reported*: it has to survive into runs/, which close() copies the log into.
    const code = await runAgentCli({ prompt: 'review the auth flow', kind: 'prompt', cwd: dir, options: { onBeforeMergeable: true } }, io)
    assert.equal(code, 0)
    const agents = join(dir, FRAMEWORK_DIR, ARCHIVE_DIR)
    const archived = (await readdir(agents)).filter(f => f.endsWith('.jsonl'))
    assert.equal(archived.length, 1, 'the run was archived')
    const events = (await readFile(join(agents, archived[0]!), 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l) as FrameworkEvent)
    const outcome = events.find(e => e.kind === 'on-before-mergeable')
    assert.ok(outcome, 'the outcome is in the archived log')
    assert.equal(outcome.kind === 'on-before-mergeable' && outcome.outcome, 'skipped')
    assert.equal(outcome.kind === 'on-before-mergeable' && outcome.outcome === 'skipped' && outcome.reason, 'not-ready-for-merge')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a run that never asked for the post-merge cleanup stays quiet about it (#835)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-obm-off-'))
  try {
    const { io } = capture()
    assert.equal(await runAgentCli({ prompt: 'review the auth flow', kind: 'prompt', cwd: dir }, io), 0)
    const events = (await readFile(join(dir, FRAMEWORK_DIR, EVENTS_FILE), 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l) as FrameworkEvent)
    assert.equal(events.some(e => e.kind === 'on-before-mergeable'), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// #905: which sessions may be steered, and which stay open for chat. Both used to be the same
// question answered by "is a daemon alive on this machine", which is not about this session at all.

test('a dashboard-spawned session is steerable through its run id (#905)', () => {
  // This is the case where every Stop press was dropped in silence: written to control.jsonl,
  // tailed by nobody.
  assert.equal(isSteerable({ persist: true, agentId: '2026-07-20T20-20-14-026Z' }), true)
})

test('with no run id, nothing can reach the session', () => {
  assert.equal(isSteerable({ persist: true }), false)
})

test('a session that does not persist is never steerable: there is no control file to tail', () => {
  assert.equal(isSteerable({ persist: false, agentId: 'r1' }), false)
})

test('a session nobody started from the dashboard does not stay open for chat (#905/#714)', () => {
  // The other half of #905: it may be reachable, but nobody is waiting, so handing it the
  // live-chat queue parked it forever. #714: "headless / CI runs end when done".
  assert.equal(isInteractive({}), false)
})

test('a session the dashboard started stays open for chat (#714)', () => {
  assert.equal(isInteractive({ agentId: 'r1' }), true)
})

test('the startup footer prints the commands and the version (#312)', async () => {
  const { io, out } = capture()
  await printStartupFooter(io, { fetchLatest: async () => frameworkVersion() })
  assert.ok(out.includes('Type a prompt on the dashboard to start an agent, or use:'))
  assert.ok(out.includes(`The Framework v${frameworkVersion()}`))
  assert.ok(out.includes(`✅ Up to date (v${frameworkVersion()})`))
})

test('the footer offers no `framework stop`: Ctrl-C is how the foreground dashboard ends (#312)', async () => {
  const { io, out } = capture()
  await printStartupFooter(io, { fetchLatest: async () => undefined })
  assert.ok(!out.some(l => l.includes('framework stop')))
  assert.ok(out.includes(`The Framework v${frameworkVersion()}`))
})

test('the footer offers no positional build command: D4 removed it, and following it exited 2', async () => {
  const { io, out } = capture()
  await printStartupFooter(io, { fetchLatest: async () => undefined })
  assert.ok(!out.some(l => l.includes('<what to build>')))
})

test('the version prints before npm answers, and a newer release is announced after (#312)', async () => {
  const { io, out } = capture()
  let release: (v: string) => void = () => {}
  const pending = printStartupFooter(io, { fetchLatest: () => new Promise<string>(resolve => (release = resolve)) })
  // The static half is out while the registry call is still in flight — bare `framework` blocks on
  // the server forever, so anything held back until after the await would never be printed there.
  assert.ok(out.includes(`The Framework v${frameworkVersion()}`))
  assert.ok(!out.some(l => l.includes('Update available')))
  release('999.0.0')
  await pending
  assert.ok(out.some(l => l.includes('⬆️  Update available: v999.0.0')))
})

test('an unreachable npm registry costs the footer nothing (#312)', async () => {
  const { io, out } = capture()
  await printStartupFooter(io, { fetchLatest: () => Promise.reject(new Error('offline')) })
  assert.ok(out.includes(`The Framework v${frameworkVersion()}`))
  assert.ok(!out.some(l => l.includes('Up to date') || l.includes('Update available')))
})

test('naming the session renames the run-id branch and records it as a branch event (#1277)', async t => {
  const { execFileSync } = await import('node:child_process')
  const repo = await mkdtemp(join(tmpdir(), 'fw-journal-'))
  t.after(() => rm(repo, { recursive: true, force: true }))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('commit', '--allow-empty', '-q', '-m', 'seed')
  // The state allocateWorkspace leaves an agent in: checked out on its run-id branch (#736).
  git('checkout', '-q', '-b', 'tf-agent-r1')
  const { io, out } = capture()
  const journal = createAgentJournal({
    io,
    cwd: repo,
    store: undefined,
    agentId: 'r1',
  })
  journal.onEvent({ kind: 'session-name', name: 'cool-name' })
  // The rename runs off the event asynchronously; wait for the recorded branch to come through.
  for (let i = 0; i < 200 && !out.some(line => line.includes('branch: tf-cool-name')); i++) {
    await new Promise(res => setTimeout(res, 10))
  }
  assert.ok(
    out.some(line => line.includes('branch: tf-cool-name')),
    `expected a branch event, got: ${out.join('; ')}`,
  )
  assert.equal(git('rev-parse', '--abbrev-ref', 'HEAD').trim(), 'tf-cool-name')
})

test('a browser URL is held until the session opens, then re-said after every later session (#1455 item 6b)', () => {
  const { io, out } = capture()
  const journal = createAgentJournal({
    io,
    cwd: '/tmp',
    store: undefined,
    agentId: undefined,
  })
  journal.announceBrowserUrl('https://early.test/')
  assert.ok(
    !out.some(l => l.includes('browser: https://early.test/')),
    'held: an event ahead of `session` never reaches the dashboard (#829)',
  )
  journal.onEvent({ kind: 'session', driver: 'claude-code', workspace: '/repo', fake: true })
  assert.ok(out.some(l => l.includes('browser: https://early.test/')))

  journal.announceBrowserUrl('https://nav.test/')
  assert.ok(out.some(l => l.includes('browser: https://nav.test/')), 'after the session a navigation emits straight away')

  // A continuation starts a fresh rendered slice; the latest URL is re-said so its transcript
  // still has a browser row to host the pane.
  const before = out.filter(l => l.includes('browser: https://nav.test/')).length
  journal.onEvent({ kind: 'session', driver: 'claude-code', workspace: '/repo', fake: true })
  assert.equal(out.filter(l => l.includes('browser: https://nav.test/')).length, before + 1)
})

/**
 * A `--run-on actions` run with no token must end as `failed`, and must end at all.
 *
 * Both halves regressed together. The config check sits after `agent.json` is written but before
 * `settleAgent` owns the agent, so returning raw left the status at `running` with nobody to correct
 * it; and the control tail it had already wired held the event loop open, so the process never
 * exited either. From the dashboard that was a session stuck on "running" forever, with the real
 * reason sitting unread in stderr.log.
 *
 * Driven through the real binary rather than a unit seam: the defect was the process failing to
 * exit, which only a process can demonstrate. `--skip-preflight` keeps it independent of whether
 * an agent CLI is installed — the abort under test happens well before any driver starts.
 */
test('a --run-on actions run with no token anywhere ends failed instead of hanging as running', async t => {
  const { execFileSync, spawn } = await import('node:child_process')
  const repo = await mkdtemp(join(tmpdir(), 'fw-actions-abort-'))
  t.after(() => rm(repo, { recursive: true, force: true }))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('remote', 'add', 'origin', 'https://github.com/example/repo.git')
  git('commit', '--allow-empty', '-q', '-m', 'seed')

  // "No token" has to mean no token *anywhere* since #1352, or this asserts nothing on a developer
  // machine whose `gh` is logged in: the env vars are scrubbed, and a stub `gh` that refuses goes
  // first on PATH so the CLI fallback finds nothing either. The rest of PATH is kept, because the
  // run still resolves its origin remote with the real git.
  const stubBin = await mkdtemp(join(tmpdir(), 'fw-actions-stub-bin-'))
  t.after(() => rm(stubBin, { recursive: true, force: true }))
  await writeFile(join(stubBin, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })

  const bin = new URL('./bin.js', import.meta.url)
  // Scrubbed, not overridden: an inherited token from the developer's shell would take the agent
  // past the very branch under test.
  const { GH_TOKEN: _gh, GITHUB_TOKEN: _gathub, ...rest } = process.env
  const env = { ...rest, PATH: `${stubBin}:${rest.PATH ?? ''}` }
  const specPath = await writeAgentSpec(spec({ prompt: 'hi', cwd: repo, agentId: 'r-actions', options: { target: 'actions' } }))
  const exit = await new Promise<number | null>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [bin.pathname, '--agent', specPath], { cwd: repo, env, stdio: 'ignore' })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      rejectPromise(new Error('the run never exited; it hung with its status left at running'))
    }, 30_000)
    child.once('error', rejectPromise)
    child.once('exit', code => {
      clearTimeout(timer)
      resolvePromise(code)
    })
  })
  assert.equal(exit, 2)

  const meta = JSON.parse(await readFile(join(repo, FRAMEWORK_DIR, 'agent.json'), 'utf8')) as {
    status: string
  }
  assert.equal(meta.status, 'failed')
  const events = (await readFile(join(repo, FRAMEWORK_DIR, EVENTS_FILE), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as { kind: string; ok?: boolean; detail?: string })
  const end = events.find(e => e.kind === 'end')
  assert.ok(end, `expected an end event, got: ${events.map(e => e.kind).join(', ')}`)
  assert.equal(end.ok, false)
  // The reason names both ways out (#1352): the variable CI sets, and the login a laptop has.
  assert.match(end.detail ?? '', /GH_TOKEN/)
  assert.match(end.detail ?? '', /gh auth login/)
})

test('runCli continues a build run through the build flow, not the prompt path (#1467)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-continue-build-'))
  try {
    const first = capture()
    assert.equal(await runAgentCli({ prompt: 'build a thing', cwd: dir }, first.io), 0)
    const metaPath = join(dir, FRAMEWORK_DIR, 'agent.json')
    assert.equal((JSON.parse(await readFile(metaPath, 'utf8')) as { kind?: string }).kind, 'build')

    const second = capture()
    const code = await runAgentCli(
      { prompt: 'keep going', kind: 'prompt', cwd: dir, continueAgent: true, options: { resumeSession: 'sess-42' } },
      second.io,
    )
    assert.equal(code, 0)
    // The continuation re-entered the build flow: a second session opened after the first end.
    const lines = (await readFile(join(dir, FRAMEWORK_DIR, EVENTS_FILE), 'utf8'))
      .trim()
      .split('\n')
      .map(l => JSON.parse(l) as { kind: string })
    const firstEnd = lines.findIndex(e => e.kind === 'end')
    assert.ok(firstEnd >= 0)
    assert.ok(lines.slice(firstEnd + 1).some(e => e.kind === 'intent'))
    // The meta still says build, and the row keeps its original label, not the resume message.
    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { kind?: string; intent?: string }
    assert.equal(meta.kind, 'build')
    assert.equal(meta.intent, 'build a thing')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('runCli keeps a prompt run continuation on the prompt path (#1467)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-continue-prompt-'))
  try {
    const first = capture()
    assert.equal(await runAgentCli({ prompt: 'say hi', kind: 'prompt', cwd: dir }, first.io), 0)
    const second = capture()
    const code = await runAgentCli(
      { prompt: 'keep going', kind: 'prompt', cwd: dir, continueAgent: true, options: { resumeSession: 'sess-42' } },
      second.io,
    )
    assert.equal(code, 0)
    const lines = (await readFile(join(dir, FRAMEWORK_DIR, EVENTS_FILE), 'utf8'))
      .trim()
      .split('\n')
      .map(l => JSON.parse(l) as { kind: string })
    // No bootstrap framing anywhere: both legs ran the direct prompt path.
    assert.ok(!lines.some(e => e.kind === 'bootstrap'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
