import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadFrameworkConfig, parseFrameworkConfig } from './config.js'

test('parseFrameworkConfig reads the mode booleans together', () => {
  assert.deepEqual(parseFrameworkConfig('transparent: true\nvanilla: true\n'), {
    transparent: true,
    vanilla: true,
  })
})

test('parseFrameworkConfig reads the vanilla toggle (C3)', () => {
  // The key the file speaks is the key everything else speaks, and it means the same direction:
  // it used to be `antiLazyPill: false` here for what is `vanilla: true` everywhere else.
  assert.deepEqual(parseFrameworkConfig('vanilla: true\n'), { vanilla: true })
  assert.throws(() => parseFrameworkConfig('vanilla: nope\n'), /"vanilla" must be a boolean/)
})

test('parseFrameworkConfig reads the transparent toggle (#625)', () => {
  assert.deepEqual(parseFrameworkConfig('transparent: true\n'), { transparent: true })
  assert.throws(() => parseFrameworkConfig('transparent: nope\n'), /"transparent" must be a boolean/)
})

test('parseFrameworkConfig reads the handoff rung (#1173/#1216)', () => {
  // How far a session publishes itself is one repo-level setting: keep it local, push the branch,
  // open a PR, merge it. The three booleans this replaced could spell combinations no session
  // could honour, and the file was where a user met them first (B5).
  assert.deepEqual(parseFrameworkConfig('handoff: local\n'), { handoff: 'local' })
  assert.deepEqual(parseFrameworkConfig('handoff: merge\n'), { handoff: 'merge' })
  // A rung nobody defines is refused by name, so a typo is a startup error rather than a session
  // that quietly publishes nothing.
  assert.throws(() => parseFrameworkConfig('handoff: publish\n'), /"handoff" must be one of local \| push \| pr \| merge/)
  assert.throws(() => parseFrameworkConfig('handoff: true\n'), /"handoff" must be one of local \| push \| pr \| merge/)
})

test('parseFrameworkConfig reads only the current spellings', () => {
  // Zero users, so a rename costs nothing to break and a migration path costs a permanent branch
  // in every reader: the keys `handoff` and `vanilla` replaced are simply unknown keys now, and an
  // unknown key is ignored. Manual migration is the whole story — rewrite the file.
  assert.deepEqual(parseFrameworkConfig('autoPushBranch: false\n'), {})
  assert.deepEqual(parseFrameworkConfig('autoOpenPr: false\nautoMerge: true\n'), {})
  assert.deepEqual(parseFrameworkConfig('antiLazyPill: false\n'), {})
  // `preset` and `event` are retired the same way: their consumer (the domain review loop) went
  // with A5, so the keys were parsed, echoed and obeyed by nothing.
  assert.deepEqual(parseFrameworkConfig('preset: software-development\nevent: bug-fix\n'), {})
})

test('parseFrameworkConfig treats an empty document as {}', () => {
  assert.deepEqual(parseFrameworkConfig(''), {})
  assert.deepEqual(parseFrameworkConfig('# just a comment\n'), {})
})

test('parseFrameworkConfig rejects a non-map document and mistyped fields', () => {
  assert.throws(() => parseFrameworkConfig('- a\n- b\n'), /must be a YAML map/)
  assert.throws(() => parseFrameworkConfig('transparent: yep\n'), /"transparent" must be a boolean/)
})

test('loadFrameworkConfig reads the-framework.yml from a directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-cfg-'))
  try {
    await writeFile(join(dir, 'the-framework.yml'), 'handoff: local\ntransparent: true\n')
    assert.deepEqual(await loadFrameworkConfig(dir), { handoff: 'local', transparent: true })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadFrameworkConfig yields {} when no config file is present', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-cfg-empty-'))
  try {
    assert.deepEqual(await loadFrameworkConfig(dir), {})
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadFrameworkConfig warns and returns {} on a malformed file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-cfg-bad-'))
  try {
    await writeFile(join(dir, 'the-framework.yml'), 'vanilla: 3\n')
    const warnings: string[] = []
    assert.deepEqual(await loadFrameworkConfig(dir, m => warnings.push(m)), {})
    assert.ok(warnings.some(w => /ignoring the-framework\.yml/.test(w)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
