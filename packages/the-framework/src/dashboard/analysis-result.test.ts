import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseAnalysisResult, readAnalysisResult } from './analysis-result.js'

test('parseAnalysisResult reads the four facts out of a real-shaped list (#1180)', () => {
  // The shape an agent actually writes: a heading, prose after an em dash, mixed case.
  const md = [
    '# Analysis result',
    '',
    '- Ambiguous: NO — the ticket spells out the fields.',
    '- Scope: small — one dashboard feature: parse the file.',
    '- Variability: low (pre-authorized for autonomous pickup)',
    '- Plan: no',
    '- New tickets: NO',
  ].join('\n')
  assert.deepEqual(parseAnalysisResult(md), { scope: 'small', variability: 'low', plan: 'no', newTickets: 'no' })
})

test('parseAnalysisResult tolerates emphasis, numbering, hyphenated keys, and multi-word values', () => {
  const md = ['1. **Scope**: very large.', '2. New-tickets: yes — TODO_AGENTS.md was created', '* `Plan`: **yes**'].join('\n')
  assert.deepEqual(parseAnalysisResult(md), { scope: 'very large', plan: 'yes', newTickets: 'yes' })
})

test('parseAnalysisResult hides a fact it cannot read as an answer, and the file without any', () => {
  // A yes/no key with prose instead of an answer is absent, not a guess; a key inside a longer
  // word (`Planning:`) is not the key; a value that is a sentence is not a scope word.
  const md = ['Plan: PLAN_foo.agent.md', 'Planning: careful', 'Scope: it depends on how the parser ends up being used'].join('\n')
  assert.equal(parseAnalysisResult(md), null)
  assert.equal(parseAnalysisResult(''), null)
  assert.equal(parseAnalysisResult('# Notes\n\nJust prose.\n'), null)
})

test('parseAnalysisResult keeps the first parseable occurrence of a fact', () => {
  const md = ['Scope: —', 'Scope: small', 'Scope: large'].join('\n')
  assert.deepEqual(parseAnalysisResult(md), { scope: 'small' })
})

test('parseAnalysisResult reads phrased yes/no answers', () => {
  const md = ['Plan: not needed', 'New tickets: none'].join('\n')
  assert.deepEqual(parseAnalysisResult(md), { plan: 'no', newTickets: 'no' })
})

test('readAnalysisResult reads ANALYSIS_RESULT.md at the checkout root, null when absent', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-analysis-'))
  try {
    assert.equal(await readAnalysisResult(cwd), null)
    await writeFile(join(cwd, 'ANALYSIS_RESULT.md'), '- Scope: small\n- Variability: low\n')
    assert.deepEqual(await readAnalysisResult(cwd), { scope: 'small', variability: 'low' })
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
