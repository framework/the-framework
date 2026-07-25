import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { provideTelefuncContext } from 'telefunc'
import { sendStart } from './control.telefunc.js'
import { presets } from '../preset-catalog.js'
import type { StartRunOptions } from '../dashboard/types.js'

// A run started from the dashboard has to name the ticket it is about to implement, the same way
// the sweep's own drain does (#1117). The daemon reads that off the `drains` flag on its job; a
// click arrives with nothing but prompt text, so the resolution happens here.

/** The options `startRun` was handed, plus a workspace with one queued ticket to resolve against. */
async function harness(): Promise<{ cwd: string; started: () => StartRunOptions | undefined }> {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-start-'))
  await writeFile(
    join(cwd, 'TODO_AGENTS.md'),
    ['## Priority 9', '', '- [ ] [Add a login page](tickets/2026-07-25_login.md)', ''].join('\n'),
  )
  let seen: StartRunOptions | undefined
  provideTelefuncContext({
    startRun: async (_text: string, _kind: string, options: StartRunOptions) => {
      seen = options
      return { ok: true, runId: 'r1' }
    },
    projects: { list: async () => [], resolvePath: async () => cwd },
  } as never)
  return { cwd, started: () => seen }
}

test('a drain started from the dashboard carries the ticket it is about to work (#1117)', async () => {
  const { cwd, started } = await harness()
  try {
    const result = await sendStart('p1', presets.drainQueue.render())
    assert.equal(result.ok, true)
    // Without this the run implemented the ticket and the Overview's in-progress lane stayed empty,
    // because only the daemon's own drain was tagging what it took off the queue.
    assert.equal(started()?.ticket, 'tickets/2026-07-25_login.md')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('any other prompt starts without a ticket, however busy the queue is (#1117)', async () => {
  const { cwd, started } = await harness()
  try {
    await sendStart('p1', 'Have a look at the login page')
    // Naming the queue's next entry here would show a ticket as being implemented on the strength
    // of a run that never touched it.
    assert.equal(started()?.ticket, undefined)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a ticket named by the caller is not replaced by the guess (#1117)', async () => {
  const { cwd, started } = await harness()
  try {
    await sendStart('p1', presets.drainQueue.render(), 'build', { ticket: 'tickets/2026-07-20_chosen.md' })
    assert.equal(started()?.ticket, 'tickets/2026-07-20_chosen.md')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
