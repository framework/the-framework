import { readAllAgents, readEventLog, readLiveMetas, type AgentMeta, type LiveAgent } from '../store/index.js'
import { sessionNameOf } from '@better-skills/branch-management'
import type { ChoiceRequest, FrameworkEvent } from '../events.js'
import { bridgeChoiceRequest, type BridgeQuestion } from './bridge-question.js'
import { bridgeQuestions } from './bridge-store.js'
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
  /**
   * Asked by a Claude web session and carried here by the browser bridge (#1237/#1554): the pick
   * goes back through `sendBridgeAnswer` on this session, not the agent's control log. The option
   * ids of {@link choice} are the labels, which is what the extension types.
   */
  bridge?: { sessionId: string; url: string }
}

/** Injectable seams so {@link buildOpenQuestions} is unit-testable off disk. */
export interface OpenQuestionsDeps {
  /** The live-agent reader (default {@link readLiveMetas}). */
  liveAgents?: (cwd: string) => Promise<LiveAgent[]>
  /** An agent checkout's event log (default {@link readEventLog}). */
  events?: (cwd: string) => Promise<FrameworkEvent[]>
  /**
   * The questions the browser bridge holds, minus those with an answer already on its way
   * (default: the daemon's bridge store).
   */
  bridged?: () => BridgeQuestion[]
  /**
   * Every agent of a project, archived included (default {@link readAllAgents}): a web agent is
   * `done` at its hand-off (#1231) and its checkout may be long gone, so the live reader alone
   * would never find the run a bridged question belongs to.
   */
  agents?: (cwd: string) => Promise<AgentMeta[]>
}

/** The bridge store's questions still waiting for a pick. */
function unansweredBridgeQuestions(): BridgeQuestion[] {
  const store = bridgeQuestions()
  return store.list().filter(question => !store.pendingAnswer(question.sessionId))
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
 * Forgiving throughout, like every cross-project rollup: an unreadable project, agent list or
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
  const agents = deps.agents ?? readAllAgents
  // One card per bridged question, whichever project claims it first: two checkouts of the same
  // repository share their `tf-data` archive, so the web run behind a question shows up under each.
  const bridged = (deps.bridged ?? unansweredBridgeQuestions)()
  const claimed = new Set<string>()
  const items: OpenQuestion[] = []
  // The session name is the branch's (#1725): read off it, never stored beside it.
  const named = (meta: AgentMeta) => {
    const sessionName = sessionNameOf(meta.branch)
    return sessionName ? { sessionName } : {}
  }
  const card = (project: ProjectSummary, meta: AgentMeta, choice: ChoiceRequest, rest: Pick<OpenQuestion, 'bridge' | 'updatedAt'>): OpenQuestion => ({
    projectId: project.id,
    projectName: project.name,
    agentId: meta.id,
    ...named(meta),
    ...(meta.intent ? { intent: meta.intent } : {}),
    choice,
    ...rest,
  })
  for (const project of projects) {
    for (const meta of await liveAgents(project.path).catch((): LiveAgent[] => [])) {
      if (meta.status !== 'running' || !meta.pendingChoice) continue
      // The agent's own checkout, not the project root: a daemon-spawned agent logs in its worktree.
      const choice = openChoiceRequest(await events(meta.cwd).catch((): FrameworkEvent[] => []), meta.pendingChoice.id)
      if (!choice) continue
      items.push(card(project, meta, choice, meta.updatedAt ? { updatedAt: meta.updatedAt } : {}))
    }
    // A web agent's question lives in the bridge store, not its log (#1554): join it on the cloud
    // session id its meta carries. The archive is read only while there is something to join.
    if (!bridged.length) continue
    for (const meta of await agents(project.path).catch((): AgentMeta[] => [])) {
      if (meta.target !== 'web' || !meta.sessionId) continue
      const question = bridged.find(q => q.sessionId === meta.sessionId && !claimed.has(q.sessionId))
      if (!question) continue
      claimed.add(question.sessionId)
      items.push(
        card(project, meta, bridgeChoiceRequest(question), {
          // Parked since the bridge saw it, which is the wait that matters here — not the hand-off.
          updatedAt: question.receivedAt,
          bridge: { sessionId: question.sessionId, url: `https://claude.ai/code/${question.sessionId}` },
        }),
      )
    }
  }
  return items.sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''))
}
