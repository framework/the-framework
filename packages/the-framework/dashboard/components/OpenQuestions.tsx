import { useRef, useState } from 'react'
import type { OpenQuestion } from '../../dist/index.js'
import { onOpenQuestions } from '../rpc/reads.js'
import { usePolled } from '../lib/use-async.js'
import { AnsweredChoice } from './AnsweredChoice.js'
import { ChoicePanel } from './ChoicePanel.js'
import { ScrollArea } from './ui/scroll-area.js'
import { cn } from '../lib/utils.js'

/** Stable initial for the poll, so it does not churn on every render. */
const EMPTY_QUESTIONS: OpenQuestion[] = []

/** One key per gate; also keys the answered memory, so a re-fired gate is a fresh card. */
const keyOf = (q: OpenQuestion) => `${q.projectId} ${q.agentId} ${q.choice.id}`

/** What the hub remembers about a gate answered from here (#1455 bonus 2). */
interface Answered {
  question: OpenQuestion
  pick: string | string[]
}

/**
 * Every session's open question, answerable in one place (#1455 item 4) — now the launcher's
 * main event (bonus 1, the shape (#299)): all choices at once in one big view with its own
 * scroll area, and a sticky jump-nav on the right instead of pagination. Longest-waiting
 * first, from the server.
 *
 * A question answered here collapses to a single line and stays (bonus 2): the card does not
 * vanish under the cursor when the poll drops the resolved gate, and clicking the line
 * re-expands what was picked. The memory is per-mount on purpose — a reload starts clean.
 *
 * The countdown is off on purpose (see ChoicePanel.countdown): a hub that renders every gate at
 * once must not auto-accept them all ten seconds after the launcher opens.
 */
export function OpenQuestions({
  onOpenSession,
}: {
  /** Jump into the session a question belongs to — it may be another project's. */
  onOpenSession: (projectId: string, agentId: string) => void
}) {
  const { value: questions, loaded } = usePolled<OpenQuestion[]>(onOpenQuestions, EMPTY_QUESTIONS, 5000, [])
  const [answered, setAnswered] = useState<Map<string, Answered>>(() => new Map())
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // One row per card, open ones first in the server's order, then the answered leftovers the
  // poll no longer returns (still shown as their collapsed line). An answered gate the poll
  // still carries renders collapsed in place, so nothing jumps while the daemon catches up.
  const rows: { key: string; question: OpenQuestion; answered?: Answered }[] = questions.map(q => {
    const key = keyOf(q)
    return { key, question: q, ...(answered.has(key) ? { answered: answered.get(key)! } : {}) }
  })
  const inPoll = new Set(rows.map(r => r.key))
  for (const [key, entry] of answered) {
    if (!inPoll.has(key)) rows.push({ key, question: entry.question, answered: entry })
  }

  // No section at all when nothing is parked and nothing was just answered: an empty
  // "Waiting on you" is noise on every launch.
  if (!loaded || rows.length === 0) return null

  const openCount = rows.filter(r => !r.answered).length
  const jumpTo = (key: string) => cardRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section aria-label="Open questions" className="border-t border-border p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Waiting on you · {openCount}
      </h2>
      <div className="flex items-start gap-3">
        {/* The one big view (#299): every card, scrolling inside its own area rather than paging. */}
        <ScrollArea className="min-w-0 flex-1" viewportClassName="max-h-[70vh]">
          <div className="space-y-3">
            {rows.map(({ key, question, answered: done }) => (
              <div
                key={key}
                ref={el => {
                  if (el) cardRefs.current.set(key, el)
                  else cardRefs.current.delete(key)
                }}
              >
                {done ? (
                  // The shared answered card (#1455 bonus 2), with the hub's extras: which
                  // session asked on the collapsed line, and the way into it when expanded.
                  <AnsweredChoice
                    choice={question.choice}
                    pick={done.pick}
                    meta={<span className="truncate">{sessionLabel(question)}</span>}
                    footer={
                      <button
                        type="button"
                        onClick={() => onOpenSession(question.projectId, question.agentId)}
                        className="mt-3 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Open session →
                      </button>
                    }
                  />
                ) : (
                  <div className="overflow-hidden rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => onOpenSession(question.projectId, question.agentId)}
                      className="flex w-full items-baseline gap-2 px-4 py-2 text-left text-xs text-muted-foreground hover:bg-accent/40"
                      title="Open this session"
                    >
                      <span className="truncate font-medium text-foreground">{sessionLabel(question)}</span>
                      <span className="truncate">{question.projectName}</span>
                      <span className="ml-auto shrink-0">Open session →</span>
                    </button>
                    <ChoicePanel
                      projectId={question.projectId}
                      agentId={question.agentId}
                      choice={question.choice}
                      countdown={false}
                      onAnswered={pick =>
                        setAnswered(prev => new Map(prev).set(key, { question, pick }))
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        {/* The jump-nav (bonus 1): on the right, beside the scroll area so it holds still while
            the cards scroll. Earned by plurality — one card needs no map to it. */}
        {rows.length > 1 && (
          <nav aria-label="Jump to a question" className="sticky top-2 w-44 shrink-0 space-y-1 self-start">
            {rows.map(({ key, question, answered: done }) => (
              <button
                key={key}
                type="button"
                onClick={() => jumpTo(key)}
                className={cn(
                  'flex w-full items-baseline gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent/40',
                  done ? 'text-muted-foreground/60' : 'text-muted-foreground',
                )}
              >
                {done && <span className="shrink-0 text-success">✓</span>}
                <span className="truncate">{sessionLabel(question)}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </section>
  )
}

/** The card's label for its session: its chosen name, else the intent's first line, else the id. */
function sessionLabel(q: OpenQuestion): string {
  return q.sessionName ?? q.intent?.split('\n')[0]?.slice(0, 80) ?? q.agentId
}
