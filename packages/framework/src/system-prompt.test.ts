import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  composeAgentSystem,
  BUSINESS_KNOWLEDGE_DOCS,
  CONTEXT_DOCS,
  renderSystemPrompt,
  systemPromptBlock,
  SYSTEM_PROMPT_TEMPLATE,
} from './system-prompt.js'
import { FLAT_TODO_FILE } from './tickets.js'
import { BRANCH_YOURSELF, DATA_BRANCH_PROTOCOL, TICKETING_FORMAT, TODO_FORMAT } from './prompts.generated.js'
import { loadUserSystemPrompt, SYSTEM_PROMPT_FILE } from './system-prompt-file.js'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'

/** The context docs as the commented bullets they render to (#559/#683). */
const KNOWLEDGE_LINES = CONTEXT_DOCS.map(d => `- \`${d.path}\` (${d.comment})`).join('\n')
/** The `Context:` block the context docs stand up on their own, with no dirs picked. */
const KNOWLEDGE_CONTEXT = `Context:\n${KNOWLEDGE_LINES}`
/** That block plus the two format specs it names, which travel in the channel with it (#1163). */
const CONTEXT_BLOCK = [KNOWLEDGE_CONTEXT, TICKETING_FORMAT, TODO_FORMAT, DATA_BRANCH_PROTOCOL].join('\n\n')

test('CONTEXT_DOCS is the repo-context fragment (#683): business knowledge plus the roadmap/queue pointers', () => {
  const paths = CONTEXT_DOCS.map(d => d.path)
  assert.deepEqual(paths, [
    'knowledge-base/DECISIONS.md',
    'GOAL.md',
    'BUSINESS_LOGIC.md',
    'knowledge-base/FACTS.md',
    'knowledge-base/INSIGHTS.md',
    'knowledge-base/MARKET_RESEARCH.md',
    'knowledge-base/**.md',
    'tickets/**.md',
    'TODO_AGENTS.md',
  ])
  // The business-knowledge docs are a subset the agent also updates at merge.
  for (const doc of BUSINESS_KNOWLEDGE_DOCS) assert.ok(paths.includes(doc.path), `missing ${doc.path}`)
  // GOAL / business logic / market research / tickets / TODO_AGENTS are read-only context, so they
  // are not in the merge-update set.
  const businessPaths = BUSINESS_KNOWLEDGE_DOCS.map(d => d.path)
  for (const p of ['GOAL.md', 'BUSINESS_LOGIC.md', 'knowledge-base/MARKET_RESEARCH.md', 'knowledge-base/**.md', 'tickets/**.md', 'TODO_AGENTS.md']) {
    assert.ok(!businessPaths.includes(p))
  }
  // The two format-bearing bullets name a section of this same channel (#1163), not a file to go
  // and open: the spec they point at has to be something the agent has already been handed.
  const tickets = CONTEXT_DOCS.find(d => d.path === 'tickets/**.md')
  assert.match(tickets?.comment ?? '', /format: the "Ticketing format" section below/)
  const todo = CONTEXT_DOCS.find(d => d.path === FLAT_TODO_FILE)
  assert.match(todo?.comment ?? '', /format: the "TODO_AGENTS.md" section below/)
  // Nothing here may point into node_modules: that path resolves only when the framework is a root
  // dependency of the repo it works on, which is what left both specs unopenable (#1163).
  for (const doc of CONTEXT_DOCS) assert.ok(!doc.comment.includes('node_modules/'), `${doc.path} points into node_modules`)
})
import { AWAIT_PROTOCOL, BROWSER_PROTOCOL, HANDS_OFF_PROTOCOL, SIGNAL_PROTOCOL } from './turn-gate.js'

test('loadUserSystemPrompt reads and trims SYSTEM.md', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'system-prompt-'))
  try {
    await writeFile(join(dir, SYSTEM_PROMPT_FILE), '\n  Always write tests first.\n')
    assert.equal(await loadUserSystemPrompt(dir), 'Always write tests first.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadUserSystemPrompt is undefined when the file is absent or empty', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'system-prompt-'))
  try {
    assert.equal(await loadUserSystemPrompt(dir), undefined) // absent
    await writeFile(join(dir, SYSTEM_PROMPT_FILE), '   \n') // whitespace only
    assert.equal(await loadUserSystemPrompt(dir), undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('SYSTEM_PROMPT_TEMPLATE carries the built-in prompt sections (#326) verbatim', () => {
  for (const section of [
    '## Analyze the user prompt',
    '### Ambiguous prompt',
    '### Scope',
    '## Before starting changes',
    '### Session name',
    '## Before applying changes',
    '### Alternatives',
    '## After applying changes',
    '# User prompt',
  ]) {
    assert.ok(SYSTEM_PROMPT_TEMPLATE.includes(section), `missing ${section}`)
  }
  // Derived from the constant, not a literal (#885): the prompt tells the agent where to write
  // its backlog, and `promoteQueue` only carries FLAT_TODO_FILE off an agent's branch. When the two
  // disagree, an unattended agent's queue is written to a name nothing ever promotes. #1420 dropped
  // the `TODO_FILE:` glossary line and names the file inline instead — the invariant is the name.
  assert.ok(SYSTEM_PROMPT_TEMPLATE.includes(`\`${FLAT_TODO_FILE}\``))
  // The analysis artifact is gone (B2): every agent wrote `ANALYSIS_RESULT.md` into the repo and
  // nothing ever read it back, so the prompt no longer asks for one.
  assert.equal(SYSTEM_PROMPT_TEMPLATE.includes('ANALYSIS_RESULT'), false)
  // #1276: an agent edited the user's own checkout through absolute paths while committing
  // relative ones in its worktree, and finished `done` with a commit holding none of the work.
  // The worktree is nested inside the repo, so the user's tree is a path prefix of the agent's
  // cwd — nothing else in the prompt tells it where its workspace ends.
  // The workspace rules moved to the `branches` skill (#1725); the prompt keeps the step that names the session.
  assert.ok(!SYSTEM_PROMPT_TEMPLATE.includes('Your working directory is the whole of your workspace'))
  assert.ok(SYSTEM_PROMPT_TEMPLATE.includes('use the `branches` skill, which says how'))
  assert.ok(SYSTEM_PROMPT_TEMPLATE.includes('Where that skill is not available, the "Branch management" section below says how instead'))
  assert.ok(SYSTEM_PROMPT_TEMPLATE.includes('${{tf.prompt}}'))
  // The whole block is the branch-free doc now: #326 moved the one `tf.params.autopilot`
  // ternary out with the maintenance section, so `tf.prompt` is the only fragment left.
  assert.equal(SYSTEM_PROMPT_TEMPLATE.match(/\$\{\{/g)?.length, 1)
})

test('SYSTEM_PROMPT_TEMPLATE no longer carries the pre-#326-rewrite headings (#555)', () => {
  // The 11-Jul draft's headings. They are what ECO_SECTION_HEADINGS used to match on, so
  // if one comes back the eco mapping below is the thing to re-check.
  for (const gone of ['## Unclear scope', '## Large scope', '## Maintenance']) {
    assert.ok(!SYSTEM_PROMPT_TEMPLATE.includes(gone), `${gone} should be gone`)
  }
})

test('renderSystemPrompt splits the system and user halves', () => {
  const { system, user } = renderSystemPrompt({ prompt: 'build a todo app' })
  assert.ok(system.startsWith('# System prompt'))
  assert.ok(system.includes('## Analyze the user prompt'))
  assert.ok(system.includes('## After applying changes'))
  assert.ok(!system.includes('# User prompt'))
  assert.ok(!system.includes('${{'), 'system half fully rendered')
  assert.equal(user, 'build a todo app')
})

test('renderSystemPrompt is not confused by a user prompt containing the heading', () => {
  const sneaky = 'do X\n# User prompt\ndo Y'
  const { system, user } = renderSystemPrompt({ prompt: sneaky })
  assert.ok(system.startsWith('# System prompt'))
  assert.equal(user, sneaky)
})

test('the channel carries the ticket and backlog format specs, so a spec can be followed (#1163)', () => {
  // The bug: both bullets pointed at `node_modules/@gemstack/the-framework/prompts/*.md`, which
  // only exists when the framework is a root dependency of the repo it works on. Everywhere else --
  // a global or npx install, a fresh worktree, this repo itself -- the agent was told to follow a
  // format it could not open, and `TODO_AGENTS.md` and `tickets/` both drifted from it.
  const block = systemPromptBlock()
  for (const [heading, spec] of [
    ['Ticketing format', TICKETING_FORMAT],
    ['TODO_AGENTS.md', TODO_FORMAT],
    ['The data branch', DATA_BRANCH_PROTOCOL],
  ] as const) {
    assert.ok(block.includes(spec), `expected the ${heading} spec in the channel`)
    assert.ok(block.includes(`# ${heading}`), `expected the ${heading} spec to open with its heading`)
    // The bullet says "below", so the spec has to actually come after the bullets.
    assert.ok(block.includes(`the "${heading}" section below`), `nothing names the ${heading} section`)
    assert.ok(block.indexOf(spec) > block.indexOf(KNOWLEDGE_CONTEXT), `the ${heading} spec is not below the bullets`)
  }
  // Framework-authored content, so `--vanilla` drops it with the docs and the built-in prompt.
  const vanilla = systemPromptBlock({ vanilla: true, user: 'Only mine.' })
  assert.ok(!vanilla.includes(TICKETING_FORMAT))
  assert.ok(!vanilla.includes(TODO_FORMAT))
  assert.ok(!vanilla.includes(DATA_BRANCH_PROTOCOL))
})

test('systemPromptBlock defaults to the knowledge-doc context line + the built-in #326 prompt', () => {
  assert.equal(systemPromptBlock(), [CONTEXT_BLOCK, renderSystemPrompt().system, BRANCH_YOURSELF].join('\n\n'))
})

test('systemPromptBlock appends the user prompt after the built-in one', () => {
  const block = systemPromptBlock({ user: 'Ship small PRs.' })
  assert.ok(block.startsWith(`${CONTEXT_BLOCK}\n\n# System prompt`))
  assert.ok(block.endsWith('Ship small PRs.'))
  assert.match(block, /AWAIT[\s\S]*Ship small PRs\./) // built-in first, then user
})

test('systemPromptBlock removes the built-in prompt when vanilla is on', () => {
  assert.equal(systemPromptBlock({ vanilla: true }), '')
  assert.equal(systemPromptBlock({ vanilla: true, user: 'Only mine.' }), 'Only mine.')
})

test('systemPromptBlock prepends a Context line for the selected directories (#439)', () => {
  const block = systemPromptBlock({ vanilla: true, user: 'Only mine.', context: ['/work/api', ' /work/ui '] })
  assert.equal(block, 'Context: /work/api, /work/ui\n\nOnly mine.') // trimmed + comma-joined, first
  assert.equal(systemPromptBlock({ vanilla: true, user: 'x', context: [] }), 'x') // empty adds nothing
  assert.equal(systemPromptBlock({ vanilla: true, user: 'x', context: ['  '] }), 'x') // blank entries dropped
})

test('systemPromptBlock puts the knowledge docs in context, after the user dirs (#537)', () => {
  const block = systemPromptBlock({ user: 'Only mine.', context: ['/work/api'] })
  assert.ok(block.startsWith(`Context: /work/api\n${KNOWLEDGE_LINES}\n\n`))
  // No dirs picked: the docs still stand up a Context block of their own.
  assert.ok(systemPromptBlock({}).startsWith(`${KNOWLEDGE_CONTEXT}\n\n`))
})

test('systemPromptBlock adds no knowledge docs when vanilla is on (#537/#547)', () => {
  // `--vanilla` is "Disable system prompt": the docs are framework-authored context, so
  // they go with the built-in prompt. Only the user's own dirs survive it.
  assert.equal(systemPromptBlock({ vanilla: true }), '')
  assert.equal(systemPromptBlock({ vanilla: true, context: ['/work/api'] }), 'Context: /work/api')
})

test('systemPromptBlock is the built-in system prompt (#326) and the user prompt, in that order, and nothing else (#457)', () => {
  // The bootstrap preamble was the last text here that was neither the built-in prompt doc (#326) nor the
  // user's own. Measured on four live agents: #326 alone already stops an empty-dir build
  // for a plan, so the override earned nothing and outranked the doc.
  // The knowledge docs (#537) join the Context line, which is paths, not prompt text.
  const block = systemPromptBlock({ user: 'Ship small PRs.', context: ['/work/api'] })
  const context = `Context: /work/api\n${KNOWLEDGE_LINES}`
  assert.equal(block, [context, TICKETING_FORMAT, TODO_FORMAT, DATA_BRANCH_PROTOCOL, renderSystemPrompt().system, BRANCH_YOURSELF, 'Ship small PRs.'].join('\n\n'))
})

test('systemPromptBlock ignores a whitespace-only user prompt', () => {
  assert.equal(systemPromptBlock({ user: '   ' }), [CONTEXT_BLOCK, renderSystemPrompt().system, BRANCH_YOURSELF].join('\n\n'))
  assert.equal(systemPromptBlock({ vanilla: true, user: '  \n ' }), '')
})

test('systemPromptBlock threads tf through to the template', () => {
  // `tf.prompt` lands in the user half, so the system half is the template's own content.
  const block = systemPromptBlock({ tf: { prompt: 'a very distinctive prompt' } })
  assert.ok(block.includes('### Alternatives'))
  assert.ok(!block.includes('a very distinctive prompt'), 'the prompt itself stays in the user half')
})

test('composeAgentSystem is exactly the built-in prompt block (#326) + both emit protocols, and nothing else (#547)', () => {
  // The one assembly path a build and a verbatim prompt both go through. Exact equality is
  // the point: no persona, skill, or memory framing may ever be appended again. The #537
  // knowledge docs are in front of that, on the context (#439) line: paths, not prompt text.
  const system = composeAgentSystem()
  assert.equal(system, [CONTEXT_BLOCK, renderSystemPrompt().system, BRANCH_YOURSELF, AWAIT_PROTOCOL, SIGNAL_PROTOCOL].join('\n\n'))
})

test('composeAgentSystem appends nothing after the protocols, whatever the options (#547)', () => {
  // Every supported option feeds the built-in prompt block (#326); none of them can add a trailing section.
  const system = composeAgentSystem({
    user: 'Ship small PRs.',
    context: ['/work/api'],
    tf: { prompt: 'build a todo app' },
  })
  const block = systemPromptBlock({
    user: 'Ship small PRs.',
    context: ['/work/api'],
    tf: { prompt: 'build a todo app' },
  })
  assert.equal(system, [block, AWAIT_PROTOCOL, SIGNAL_PROTOCOL].join('\n\n'))
  assert.ok(system.endsWith(SIGNAL_PROTOCOL), 'the signal protocol is the last thing in the channel')
})

test('composeAgentSystem says nothing about a browser unless the run has one (#824)', () => {
  // The default: no browser wired, so no claim of one. An agent told it has tools it does not
  // have is worse than one that reaches for WebFetch.
  assert.ok(!composeAgentSystem().includes(BROWSER_PROTOCOL))
})

test('composeAgentSystem tells the agent it has a browser when the run does (#824)', () => {
  // Without this the chrome-devtools tools are wired but never mentioned, so the agent uses
  // WebFetch and the browser (and its preview) sits on about:blank for the whole agent.
  const system = composeAgentSystem({ browser: true })
  assert.ok(system.includes(BROWSER_PROTOCOL))
  assert.ok(system.endsWith(SIGNAL_PROTOCOL), 'the signal protocol is still last (#547)')
})

test('the browser section survives --vanilla but not transparent (#824)', () => {
  // It describes what the agent can do, like the emit protocols, so dropping the built-in prompt
  // keeps it. Transparent means an empty channel, so nothing at all.
  assert.ok(composeAgentSystem({ vanilla: true, browser: true }).includes(BROWSER_PROTOCOL))
  assert.equal(composeAgentSystem({ transparent: true, browser: true }), '')
})

test('composeAgentSystem stays quiet about hands-off unless the run is one (#1225)', () => {
  // A local agent lands its work through the framework, not on its own.
  assert.ok(!composeAgentSystem().includes(HANDS_OFF_PROTOCOL))
})

test('a hands-off run is told to land everything, after the await protocol it keeps (#1225/#1554)', () => {
  // Nothing here sees the session's workspace, so it commits and opens its own PR. Its gates are
  // the same as a local agent's: it parks, and the answer reaches it through the browser bridge
  // or on claude.ai itself — there is no decide-alone mode. The signal protocol stays last (#547).
  const system = composeAgentSystem({ handsOff: true })
  assert.ok(system.includes(HANDS_OFF_PROTOCOL))
  assert.ok(system.indexOf(HANDS_OFF_PROTOCOL) > system.indexOf(AWAIT_PROTOCOL))
  assert.ok(!system.includes('decide alone'))
  assert.ok(system.endsWith(SIGNAL_PROTOCOL), 'the signal protocol is still last (#547)')
})

test('the hands-off block survives --vanilla but not transparent (#1225)', () => {
  assert.ok(composeAgentSystem({ vanilla: true, handsOff: true }).includes(HANDS_OFF_PROTOCOL))
  assert.equal(composeAgentSystem({ transparent: true, handsOff: true }), '')
})

test('composeAgentSystem keeps the emit protocols even with the built-in prompt off (#500/#501)', () => {
  // The drift that #500 fixed, now pinned at the single assembly point: --vanilla drops the
  // #326 block, but the agent still gets the AWAIT + SIGNAL emit contract.
  const system = composeAgentSystem({ vanilla: true })
  assert.ok(!system.includes('# System prompt'), 'built-in #326 prompt is off')
  assert.equal(system, [AWAIT_PROTOCOL, SIGNAL_PROTOCOL].join('\n\n'))
})

test('composeAgentSystem is empty under transparent mode — no prompt, no emit protocols (#625)', () => {
  // Transparent (#625) is stronger than --vanilla: the whole system channel is dropped, protocols
  // included, so the agent runs as raw `claude -p`. It overrides every other option.
  assert.equal(composeAgentSystem({ transparent: true }), '')
  assert.equal(
    composeAgentSystem({ transparent: true, vanilla: false, user: 'ignored', context: ['/work/api'] }),
    '',
  )
})

test('an agent in its own checkout is sent to the `branches` skill, which the checkout carries; anyone else branches with git (#1725, #1739)', () => {
  const block = systemPromptBlock({ ownedCheckout: true, user: 'Mine too.' })
  // The session-name step sends the agent to the skill. The skill itself is the checkout's — the
  // skill-branches package links it where the agent's harness looks — so none of it rides here.
  assert.ok(block.includes('use the `branches` skill'))
  assert.ok(!block.includes('branches name <name>'))
  assert.ok(!block.includes(BRANCH_YOURSELF))
  assert.ok(block.indexOf('### Session name') < block.indexOf('Mine too.'), "the user's own prompt stays last")
  // The step defers to the skill: no branch the agent creates itself, no signal.
  assert.ok(!block.includes('git checkout'))
  assert.ok(!block.includes('setSessionName'))
  // Outside a checkout The Framework created — a terminal run in the user's own checkout, an Actions
  // runner, a cloud session — the command is not on the PATH: the section that has it branch with git.
  for (const opts of [{}, { handsOff: true }]) {
    const elsewhere = systemPromptBlock(opts)
    assert.ok(!elsewhere.includes('branches name <name>'), JSON.stringify(opts))
    assert.ok(elsewhere.includes(BRANCH_YOURSELF), JSON.stringify(opts))
    assert.ok(BRANCH_YOURSELF.startsWith('# Branch management') && BRANCH_YOURSELF.includes('git checkout -b agent-<SESSION_NAME>'))
  }
  // Framework-authored, so `--vanilla` drops it with the prompt: the on-before-mergeable follow-up
  // must not rename or create a branch after a session of its own (#560).
  for (const opts of [{ vanilla: true, ownedCheckout: true, user: 'Only mine.' }, { vanilla: true, user: 'Only mine.' }]) {
    const vanilla = systemPromptBlock(opts)
    assert.ok(!vanilla.includes(BRANCH_YOURSELF) && !vanilla.includes('Branch management') && !vanilla.includes('`branches` skill'), JSON.stringify(opts))
  }
})
