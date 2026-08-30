import { TICKETS_DIR } from '@gemstack/skill-tickets/names'
import type { AgentMeta } from './store/index.js'

/**
 * The ask for one ticket's plan (#685): `Create tickets/<stem>.plan.md`, the `.md` swapped for the
 * sibling `.plan.md` the plan views read. The one wording for plan work wherever it is asked —
 * the sentence the [Plan tickets] preset queues, the plan column starts an attended agent with,
 * and the dashboard's bulk queue-add writes as entries — so the surfaces cannot drift apart
 * (#1187) and a queued copy is recognizable by exact text.
 */
export function planTicketPrompt(file: string): string {
  return `Create ${TICKETS_DIR}/${file.replace(/\.md$/, '')}.plan.md`
}

/**
 * The agent that wrote a ticket's plan (#1511): the newest agent whose ask names that plan — the
 * {@link planTicketPrompt} sentence, as the plan column starts it and as a pinned queue drain
 * carries it. There is no marker in the plan file itself, so the link is made from the
 * framework's own records instead. A plan written by a run whose ask never named it (a single
 * unpinned drain reading "the first open entry") is not attributed.
 */
export function planAgentFor(agents: AgentMeta[], file: string): AgentMeta | undefined {
  const ask = planTicketPrompt(file)
  return agents.filter(agent => agent.intent?.includes(ask)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}
