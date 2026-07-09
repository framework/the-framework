import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ANTI_LAZY_PILL,
  loadUserSystemPrompt,
  systemPromptBlock,
  SYSTEM_PROMPT_FILE,
} from './system-prompt.js'

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

test('systemPromptBlock defaults to the anti-lazy-pill alone', () => {
  assert.equal(systemPromptBlock(), ANTI_LAZY_PILL)
})

test('systemPromptBlock appends the user prompt after the pill', () => {
  const block = systemPromptBlock({ user: 'Ship small PRs.' })
  assert.ok(block.startsWith(ANTI_LAZY_PILL))
  assert.ok(block.endsWith('Ship small PRs.'))
  assert.match(block, /AWAIT[\s\S]*Ship small PRs\./) // pill first, then user
})

test('systemPromptBlock removes the pill when antiLazyPill is false', () => {
  assert.equal(systemPromptBlock({ antiLazyPill: false }), '')
  assert.equal(systemPromptBlock({ antiLazyPill: false, user: 'Only mine.' }), 'Only mine.')
})

test('systemPromptBlock ignores a whitespace-only user prompt', () => {
  assert.equal(systemPromptBlock({ user: '   ' }), ANTI_LAZY_PILL)
  assert.equal(systemPromptBlock({ antiLazyPill: false, user: '  \n ' }), '')
})
