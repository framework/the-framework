import { readEventLog, readLiveMetas, type LiveAgent } from '../store/index.js'
import type { ChoiceRequest, FrameworkEvent } from '../events.js'
import type { ProjectSummary } from './projects.js'

// Every session's open question, in one place (#1455 item 4).
//
// An agent parked on a choice gate was only answerable from inside its own session view; with
// several sessions running the questions scattered, and the Overview badge could only count
// them. The launcher's hub needs the *full* gate — options, multi, recommended — and that is
// not on the agent meta: `pendingChoice` carries only id and title, because that is all the rail's
// badge needed. The options live in the `choice` event, so this reads each parked agent's log
// through the store's own reader — the same move the Discord chat surface makes (live-run.ts),
// which keeps one torn-line policy rather than a drifted copy.

/** One session's open question: the full gate, answerable from wherever it is rendered. */
export interface OpenQuestion {
  projectId: string
  projectName: string
  agentId: string
  /** The session's name (#326) when it chose one — the card's label; else fall back to {@link intent}. */
  sessionName?: string
  /** What the agent was asked to do, for a card whose session never named itself. */
  intent?: string
  /** When the agent last spoke, ISO: what the longest-waiting-first order sorts on. */
  updatedAt?: string
  choice: ChoiceRequest
}

/** Injectable seams so {@link buildOpenQuestions} is unit-testable off disk. */
export interface OpenQuestionsDeps {
  /** The live-agent reader (default {@link readLiveMetas}). */
  liveAgents?: (cwd: string) => Promise<LiveAgent[]>
  /** An agent checkout's event log (default {@link readEventLog}). */
  events?: (cwd: string) => Promise<FrameworkEvent[]>
}

/**
 * The full {@link ChoiceRequest} still open under this id: its `choice` event with no later
 * `choice-resolved` for the same id. The sibling of live-run.ts's `openGate`, which slims the
 * gate down to what chat can render — an answering *panel* needs everything the event carried
 * (multi, recommended, detail lines), so this keeps the request whole.
 */
export function openChoiceRequest(events: FrameworkEvent[], gateId: string): ChoiceRequest | undefined {
  let open: ChoiceRequest | undefined
  for (const event of events) {
    if (event.kind === 'choice' && event.id === gateId) {
      const { kind: _kind, ...request } = event
      open = request
    } else if (event.kind === 'choice-resolved' && event.id === gateId) {
      open = undefined
    }
  }
  return open
}

/**
 * Every project's parked questions, longest-waiting first (#1455): an agent that has been blocked
 * on its human the longest is the one to unblock first.
 *
 * Forgiving throughout, like every cross-project rollup: an unreadable project, run list or
 * event log contributes nothing rather than failing the read. A pending gate whose log no
 * longer shows it open (already resolved, log unreadable) is skipped — offering an answer the
 * daemon would refuse is worse than one card fewer.
 */
export async function buildOpenQuestions(
  projects: ProjectSummary[],
  deps: OpenQuestionsDeps = {},
): Promise<OpenQuestion[]> {
  const liveAgents = deps.liveAgents ?? readLiveMetas
  const events = deps.events ?? readEventLog
  const items: OpenQuestion[] = []
  for (const project of projects) {
    for (const meta of await liveAgents(project.path).catch((): LiveAgent[] => [])) {
      if (meta.status !== 'running' || !meta.pendingChoice) continue
      // The agent's own checkout, not the project root: a daemon-spawned agent logs in its worktree.
      const choice = openChoiceRequest(await events(meta.cwd).catch((): FrameworkEvent[] => []), meta.pendingChoice.id)
      if (!choice) continue
      items.push({
        projectId: project.id,
        projectName: project.name,
        agentId: meta.id,
        ...(meta.sessionName ? { sessionName: meta.sessionName } : {}),
        ...(meta.intent ? { intent: meta.intent } : {}),
        ...(meta.updatedAt ? { updatedAt: meta.updatedAt } : {}),
        choice,
      })
    }
  }
  return items.sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''))
}
