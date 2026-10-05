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

/** What `agent-scheduler status` prints for a scheduler that ticked once with a two-line schedule. */
export const STATUS = {
  ok: true,
  on: true,
  keepAlive: false,
  model: 'opus',
  spendOffset: 7,
  running: true,
  pid: 4242,
  switches: { 'post-merge-cleanup': true },
  publishes: { 'work-queue': 'nothing' },
  lastTick: {
    at: '2026-10-03T10:00:00.000Z',
    decisions: [
      { command: 'work-queue', outcome: 'started', run: '2026-10-03T10-00-00-000Z' },
      { command: 'post-merge-cleanup', outcome: 'not due' },
    ],
    schedule: [
      { command: 'work-queue', when: 'npx queue', on: true, publish: 'merge' },
      { command: 'post-merge-cleanup', every: '1d', on: false },
    ],
  },
}
