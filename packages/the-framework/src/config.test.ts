import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadFrameworkConfig, parseFrameworkConfig } from './config.js'

test('parseFrameworkConfig reads preset + mode booleans + event', () => {
  assert.deepEqual(parseFrameworkConfig('preset: software-development\ntransparent: true\nevent: bug-fix\n'), {
    preset: 'software-development',
    transparent: true,
    event: 'bug-fix',
  })
})

test('parseFrameworkConfig reads the vanilla toggle (C3)', () => {
  // The key the file speaks is the key everything else speaks, and it means the same direction:
  // it used to be `antiLazyPill: false` here for what is `vanilla: true` everywhere else.
  assert.deepEqual(parseFrameworkConfig('vanilla: true\n'), { vanilla: true })
  assert.throws(() => parseFrameworkConfig('vanilla: nope\n'), /"vanilla" must be a boolean/)
  // The old name is migrated, inverted: `antiLazyPill: false` is the repo opting out of the #326
  // prompt, which is `vanilla: true`. Dropping the key would silently re-inject the prompt.
  assert.deepEqual(parseFrameworkConfig('antiLazyPill: false\n'), { vanilla: true }, 'antiLazyPill: false → vanilla: true')
  assert.deepEqual(parseFrameworkConfig('antiLazyPill: true\n'), { vanilla: false }, 'antiLazyPill: true → vanilla: false')
  // The new name wins when both are present, rather than the legacy key overriding it.
  assert.deepEqual(parseFrameworkConfig('vanilla: false\nantiLazyPill: false\n'), { vanilla: false })
  assert.throws(() => parseFrameworkConfig('antiLazyPill: nope\n'), /"antiLazyPill" must be a boolean/)
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

test('parseFrameworkConfig reads a pre-B5 file by the three keys it replaced', () => {
  // A committed `autoPushBranch: false` is a repo asking not to be published. Ignoring the key it
  // says that with does not leave the repo where it was — it lands on the default, which pushes the
  // branch and opens a PR the file declined. So the old spelling still resolves to a rung.
  assert.deepEqual(parseFrameworkConfig('autoPushBranch: false\n'), { handoff: 'local' })
  assert.deepEqual(parseFrameworkConfig('autoOpenPr: false\n'), { handoff: 'push' })
  assert.deepEqual(parseFrameworkConfig('autoMerge: true\n'), { handoff: 'merge' })
  // "PR without push" was never a state a session could honour; as a rung it resolves downward
  // rather than turning the push back on.
  assert.deepEqual(parseFrameworkConfig('autoPushBranch: false\nautoOpenPr: true\n'), { handoff: 'local' })
  // Spelling both wins on the new key, and a file saying nothing still says nothing.
  assert.deepEqual(parseFrameworkConfig('handoff: local\nautoMerge: true\n'), { handoff: 'local' })
  assert.deepEqual(parseFrameworkConfig('vanilla: true\n'), { vanilla: true })
  // Still typed, like every other key, and the error points at the spelling that replaced it.
  assert.throws(() => parseFrameworkConfig('autoMerge: yes please\n'), /"autoMerge" must be a boolean/)
})

test('parseFrameworkConfig treats an empty document as {}', () => {
  assert.deepEqual(parseFrameworkConfig(''), {})
  assert.deepEqual(parseFrameworkConfig('# just a comment\n'), {})
})

test('parseFrameworkConfig rejects a non-map document and mistyped fields', () => {
  assert.throws(() => parseFrameworkConfig('- a\n- b\n'), /must be a YAML map/)
  assert.throws(() => parseFrameworkConfig('preset: 3\n'), /"preset" must be a string/)
  assert.throws(() => parseFrameworkConfig('event: 3\n'), /"event" must be a string/)
  assert.throws(() => parseFrameworkConfig('transparent: yep\n'), /"transparent" must be a boolean/)
})

test('loadFrameworkConfig reads the-framework.yml from a directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-cfg-'))
  try {
    await writeFile(join(dir, 'the-framework.yml'), 'preset: software-development\ntransparent: true\n')
    assert.deepEqual(await loadFrameworkConfig(dir), { preset: 'software-development', transparent: true })
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
    await writeFile(join(dir, 'the-framework.yml'), 'preset: 3\n')
    const warnings: string[] = []
    assert.deepEqual(await loadFrameworkConfig(dir, m => warnings.push(m)), {})
    assert.ok(warnings.some(w => /ignoring the-framework\.yml/.test(w)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
