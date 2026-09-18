import { contextProjects, contextQuota } from './context.js'
import type { QuotaView } from '../dashboard/quota.js'
import { runOffsetHook } from '../project-hooks.js'
import type { ProjectSummary } from '../dashboard/projects.js'

// The usage panel's surface (#533): where the account's subscription quota stands, and where it
// stands against the quota boundary (#879); and the one write, the slider's spend offset (#960).
// The source is wired into the dashboard context by the daemon, and the panel polls it for its
// whole life.

/** An honest empty view: no reading, and so no boundary to measure against. */
function noReading(): QuotaView {
  // No windows and no boundary rather than zeroes: an empty bar reads as
  // "nothing used", which is the one thing this panel must never imply.
  return { windows: [], unavailable: 'fetch-failed' }
}

/** Where the account's quota stands against its boundary. */
export async function onQuota(): Promise<QuotaView> {
  return contextQuota().read().catch(() => noReading())
}

/**
 * Set how far past the quota boundary unattended work may go (#960): every registered project's
 * `offset` hook line, with the points in `POINTS`. The daemon names no tool: the line is the
 * project's, and what it writes is what the panel reads back.
 */
export async function sendSpendOffset(points: number): Promise<{ ok: true } | { ok: false; error: string }> {
  return setSpendOffset(await contextProjects().list().catch(() => []), points)
}

/**
 * The write behind {@link sendSpendOffset}, over the projects given. A project without the line is
 * skipped; none having it, or a line that fails, is the answer's error, each failing project named.
 */
export async function setSpendOffset(
  projects: readonly ProjectSummary[],
  points: number,
  run: typeof runOffsetHook = runOffsetHook,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isFinite(points)) return { ok: false, error: 'the spend offset must be a number' }
  let hooked = 0
  const failed: string[] = []
  for (const project of projects) {
    const set = await run(project.path, points)
    if (set.ok) hooked++
    else if (!set.noHook) failed.push(`${project.name}: ${set.error}`)
  }
  if (failed.length) return { ok: false, error: failed.join('; ') }
  if (!hooked) return { ok: false, error: 'no project has an offset hook in .the-framework/hooks.yml' }
  return { ok: true }
}
