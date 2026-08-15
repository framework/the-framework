import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPrompt, extendPrompt, isWorkspaceEmpty, scaffoldPrompt } from './steps.js'

/** Make a throwaway workspace dir, seeded with the given relative files. */
function makeWorkspace(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'fw-steps-'))
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, contents)
  }
  return dir
}

test('isWorkspaceEmpty: true for an empty dir and one with only noise, false with a source file', () => {
  const empty = makeWorkspace()
  const noise = makeWorkspace({
    'package-lock.json': '{}',
    '.gitignore': 'node_modules',
    'node_modules/dep/index.js': 'x',
  })
  const built = makeWorkspace({ 'src/index.ts': 'export {}' })
  try {
    assert.equal(isWorkspaceEmpty(empty), true)
    assert.equal(isWorkspaceEmpty(noise), true)
    assert.equal(isWorkspaceEmpty(built), false)
    assert.equal(isWorkspaceEmpty(join(empty, 'does-not-exist')), true)
  } finally {
    for (const d of [empty, noise, built]) rmSync(d, { recursive: true, force: true })
  }
})

test('buildPrompt frames a from-scratch build, and says the workspace may be empty', () => {
  const prompt = buildPrompt('a blog')
  assert.match(prompt, /a blog/)
  assert.match(prompt, /Build this app end to end/i)
  assert.match(prompt, /workspace may be empty/i)
  assert.doesNotMatch(prompt, /existing codebase/i)
})

test('extendPrompt names the work and the workspace, and nothing else (#1224)', () => {
  const prompt = extendPrompt('add a settings page')
  assert.match(prompt, /add a settings page/)
  // The one thing the agent cannot infer: this codebase already exists.
  assert.match(prompt, /existing codebase/i)
  // #1224: the rules telling it how to behave are gone, not reworded.
  assert.doesNotMatch(prompt, /do NOT re-scaffold|swap its stack|smallest coherent|read the existing code first/i)
  // #1372: the set-scope ask went with the production-grade gate it existed to skip.
  assert.doesNotMatch(prompt, /set-scope/)
  // And it never tells the agent the directory might be empty — it is not (#185).
  assert.doesNotMatch(prompt, /scaffold the whole project|workspace may be empty/i)
})

test('scaffoldPrompt is the hard directive for a build that produced nothing (#182)', () => {
  const prompt = scaffoldPrompt('a blog')
  assert.match(prompt, /a blog/)
  assert.match(prompt, /from scratch/i)
  // The point of the retry: an empty directory is expected, not a reason to refuse.
  assert.match(prompt, /do\s+not refuse because the directory is empty/i)
})
