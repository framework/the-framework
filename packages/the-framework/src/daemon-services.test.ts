import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resumeSuspendedRuns } from './daemon-services.js'
import { writeSuspendedRuns } from './store/index.js'
import type { StartRunOptions, StartRunResult } from './dashboard/types.js'

test("resume hands the drain's pin back, so the resumed run re-emits its claim (#1268)", async () => {
  const config = await mkdtemp(join(tmpdir(), 'framework-resume-cfg-'))
  const project = await mkdtemp(join(tmpdir(), 'framework-resume-proj-'))
  try {
    // A minimal registry naming the project, in an isolated XDG config.
    await writeFile(
      join(config, 'the-framework.json'),
      JSON.stringify({ projects: [{ id: 'proj-1', path: project, addedAt: '2026-07-27T00:00:00.000Z' }] }),
    )
    await mkdir(join(project, '.the-framework'), { recursive: true })
    await writeSuspendedRuns(project, [
      { runId: 'run-pinned', suspendedAt: new Date().toISOString(), sessionId: 'sess-9', queueEntry: 'entry beta: fix the readme typo' },
      { runId: 'run-plain', suspendedAt: new Date().toISOString() },
    ])

    const starts: { prompt: string; options: StartRunOptions }[] = []
    const startRun = async (prompt: string, options: StartRunOptions): Promise<StartRunResult> => {
      starts.push({ prompt, options })
      return { ok: true, runId: options.continueRunId ?? 'r' }
    }
    await resumeSuspendedRuns({ XDG_CONFIG_HOME: config }, startRun, () => {})

    assert.equal(starts.length, 2)
    const pinned = starts.find(s => s.options.continueRunId === 'run-pinned')!
    // The pin travels back verbatim; startOptionFlags turns it into --queue-entry, and the
    // resumed process re-emits the queue-entry event whether or not the meta replay kept it.
    assert.equal(pinned.options.queueEntry, 'entry beta: fix the readme typo')
    assert.equal(pinned.options.resumeSession, 'sess-9')
    // A run that was never pinned stays unpinned: no invented claim.
    const plain = starts.find(s => s.options.continueRunId === 'run-plain')!
    assert.equal(plain.options.queueEntry, undefined)
  } finally {
    await rm(config, { recursive: true, force: true })
    await rm(project, { recursive: true, force: true })
  }
})
