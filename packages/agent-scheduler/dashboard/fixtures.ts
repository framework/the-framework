import { vi } from 'vitest'
import type { ModuleCommandResult, ModuleHost } from '@openagt/dashboard/module'

// What the module's tests share: a fake dashboard host, and what the command prints.

/** A host whose command answers what `answer` says per project and arguments. */
export function hostAnswering(answer: (projectId: string, args: string[]) => ModuleCommandResult) {
  const runCommand = vi.fn(async (projectId: string, args: string[]) => answer(projectId, args))
  const host: ModuleHost = {
    package: '@openagt/agent-scheduler',
    runCommand,
    act: runCommand,
    read: vi.fn(async () => ({ ok: false as const, error: 'no server part' })),
    openAgent: vi.fn(),
    openPage: vi.fn(),
    startRun: vi.fn(async () => ({ ok: false as const, error: 'not here' })),
    configureRun: vi.fn(),
    agents: vi.fn(async () => []),
  }
  return { host, runCommand }
}

/** What `agent-scheduler status` prints for a scheduler that ticked once in a project whose skills schedule two commands: one switched on here, one with a publish pick made here. */
export const STATUS = {
  ok: true,
  on: true,
  keepAlive: false,
  model: 'opus',
  spendOffset: 7,
  running: true,
  pid: 4242,
  switches: { 'post-merge-cleanup': '2026-10-03T08:00:00.000Z' },
  publishes: { 'work-queue': 'nothing' },
  lastTick: {
    at: '2026-10-03T10:00:00.000Z',
    decisions: [
      { command: 'post-merge-cleanup', outcome: 'started 2026-10-03T10-00-00-000Z', run: '2026-10-03T10-00-00-000Z' },
      { command: 'work-queue', outcome: 'switched off on this machine' },
    ],
    schedule: [
      { command: 'post-merge-cleanup', every: '1d', description: 'Write up merged pull requests.' },
      { command: 'work-queue', when: 'npx queue', waitsFor: 'when the queue holds a task', description: 'Work one queued task.' },
    ],
  },
}
