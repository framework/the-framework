import { sessionNameOf } from '@gemstack/skill-branches/branch-names'
import type { FrameworkEvent } from './events.js'

// Derived agent state for the dashboard (#431): the session name a view carries, and the live
// session link — a pure projection of the same FrameworkEvent stream the log renders, so the live
// dashboard and a past-agent replay show the identical summary. Kept here (not in the dashboard)
// so it is unit-tested against the real event shapes.

/**
 * The `sessionName` a derived view carries (#1725): the name the agent's branch carries, as a
 * field that is present only when there is one — so a view of an unnamed agent has no name,
 * rather than a name that is `undefined`. The one spelling behind every view built from an
 * agent's record.
 */
export function sessionNameField(branch: string | undefined, agentId: string): { sessionName?: string } {
  const sessionName = sessionNameOf(branch, agentId)
  return sessionName ? { sessionName } : {}
}

/** The wrapped agent session (#431): its id and a deep link, when one is known. */
export interface SessionInfo {
  driver?: string
  fake?: boolean
  sessionId?: string
  sessionLink?: string
  /**
   * The directory the agent ran in (#1195), from the opening `session` event.
   *
   * Taken from the event rather than the filesystem on purpose: an agent that finishes cleanly has
   * its checkout reclaimed by the tool that runs it, so the event is the only surviving record of where
   * the session lived — and that path is exactly what `claude --resume` needs to find it again.
   */
  workspace?: string
  /**
   * The model id the current leg's agent was started with (#1438). Folded per leg like the
   * driver/workspace: the latest `session` event wins, and a leg that recorded none clears it.
   */
  model?: string
}

/**
 * The session behind the agent (#431): the driver + workspace from the opening `session`
 * event, then the id and any deep link from the latest `session-update`. Null before the
 * session opens. The link is what the old dashboard surfaced as "open session".
 */
export function sessionInfo(events: readonly FrameworkEvent[]): SessionInfo | null {
  let info: SessionInfo | null = null
  for (const event of events) {
    if (event.kind === 'session') {
      info = {
        driver: event.driver,
        fake: event.fake,
        workspace: event.workspace,
        ...(event.sessionLink ? { sessionLink: event.sessionLink } : {}),
        ...(event.model ? { model: event.model } : {}),
      }
    } else if (event.kind === 'session-update') {
      info = { ...(info ?? {}), sessionId: event.sessionId, ...(event.sessionLink ? { sessionLink: event.sessionLink } : {}) }
    }
  }
  return info
}
