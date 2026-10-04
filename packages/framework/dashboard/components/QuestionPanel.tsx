import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { ChoiceRequest } from '../../src/index.js'
import { sendChoice, sendMessage } from '../rpc/control.js'
import { useAction } from '../lib/use-action.js'
import { cn } from '../lib/utils.js'
import { Button } from './ui/button.js'

/** What Skip says to the agent: the person's own message, shown in the chat like any other. */
export const SKIP_MESSAGE = 'I skip this question.'

/** The pick that is no option: the person's own words, typed in the "Other" row. */
const OTHER = Symbol('other')

function Key({ n }: { n: number }) {
  return (
    <kbd className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-border px-1 font-sans text-[11px] text-muted-foreground" aria-hidden>
      {n}
    </kbd>
  )
}

// The question an agent's turn ended on, as a panel above the message box, the way Claude Code on
// the web asks: the title, one row per option (its label, its description, the number key that
// picks it), an "Other" row to answer in one's own words, and Skip / Submit. An option's pick goes
// over the control RPC, which hands the chosen labels to the agent; "Other" and Skip go as the
// person's own message, which continues the agent like any message. Mount it with
// `key={choice.id}` so a question asked again starts fresh. `active` binds the keys.
export function QuestionPanel({
  projectId,
  agentId,
  choice,
  active = false,
  onSaid,
}: {
  projectId: string
  agentId: string
  choice: ChoiceRequest
  /** The one question the keys answer: the number keys pick, Ctrl+Enter submits. */
  active?: boolean
  /** Told the message "Other" or Skip sent, so the chat can show it at once. */
  onSaid?: ((text: string) => void) | undefined
}) {
  const { busy, error, run } = useAction()
  // Sent and accepted by the daemon: the panel stays, its controls off, until the agent going on
  // takes it away. A refusal is shown in the daemon's own words, and the controls come back.
  const [sent, setSent] = useState(false)
  const [picked, setPicked] = useState<string | typeof OTHER | undefined>(() => (choice.multi ? undefined : (choice.recommended ?? choice.options[0]?.id)))
  const [checked, setChecked] = useState<Set<string>>(() => new Set(choice.multi ? choice.options.filter(o => o.default).map(o => o.id) : []))
  const [other, setOther] = useState('')
  const otherInput = useRef<HTMLInputElement>(null)
  const parked = busy || sent
  const words = other.trim()

  const deliver = (fn: () => Promise<unknown>) => void run(fn, 'Could not send your answer — try again.').then(outcome => outcome.ok && setSent(true))
  const say = (text: string) =>
    deliver(async () => {
      const result = await sendMessage(projectId, text, agentId)
      if (result.ok) onSaid?.(text)
      return result
    })

  // A single pick with "Other" chosen needs its words; everything else can always be sent.
  const ready = choice.multi || picked !== OTHER || words !== ''
  const submit = () => {
    if (parked || !ready) return
    if (choice.multi) {
      // Words in "Other" go with the checked options' labels, as one message: the agent reads both.
      if (words !== '') return say([...choice.options.filter(o => checked.has(o.id)).map(o => o.label), words].join(', '))
      return deliver(() => sendChoice(projectId, choice.id, [...checked], agentId))
    }
    if (picked === OTHER) return say(words)
    if (picked !== undefined) deliver(() => sendChoice(projectId, choice.id, picked, agentId))
  }
  const pick = (id: string) => {
    if (parked) return
    if (!choice.multi) return setPicked(id)
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // The latest of everything the key handler reads, so the handler is wired up once.
  const keys = useRef({ submit, pick })
  keys.current = { submit, pick }
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      // Keys typed into a text field are that field's, except this panel's own "Other" row.
      const target = e.target as HTMLElement | null
      const typing = target !== null && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (typing && target !== otherInput.current) return
        e.preventDefault()
        keys.current.submit()
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || !/^[1-9]$/.test(e.key)) return
      const n = Number(e.key)
      const option = choice.options[n - 1]
      if (option) keys.current.pick(option.id)
      else if (n === choice.options.length + 1) otherInput.current?.focus()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, choice.options])

  const row = (on: boolean) => cn('flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left', on ? 'border-primary bg-accent/60' : 'border-border hover:bg-accent/40')
  return (
    <section role="region" aria-label={choice.title} className="mx-auto w-full max-w-3xl px-2 pt-2">
      <div className="rounded-xl border border-border bg-card p-3">
        <h2 className="mb-2 px-1 text-sm font-medium">{choice.title}</h2>
        <ul className="flex flex-col gap-1.5">
          {choice.options.map((o, at) => {
            const on = choice.multi ? checked.has(o.id) : picked === o.id
            return (
              <li key={o.id}>
                <button type="button" role={choice.multi ? 'checkbox' : 'radio'} aria-checked={on} disabled={parked} onClick={() => pick(o.id)} className={cn(row(on), 'disabled:opacity-60')}>
                  {choice.multi && (
                    <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')} aria-hidden>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {o.label}
                      {o.id === choice.recommended && <span className="ml-2 text-xs font-normal text-muted-foreground">Recommended</span>}
                    </span>
                    {o.detail && <span className="block text-xs text-muted-foreground">{o.detail}</span>}
                  </span>
                  <Key n={at + 1} />
                </button>
              </li>
            )
          })}
          <li>
            <label className={cn(row(choice.multi ? words !== '' : picked === OTHER), 'items-center')}>
              <input
                ref={otherInput}
                value={other}
                disabled={parked}
                onFocus={() => !choice.multi && setPicked(OTHER)}
                onChange={e => setOther(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) submit()
                }}
                placeholder="Other: say it in your own words"
                aria-label="Other"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Key n={choice.options.length + 1} />
            </label>
          </li>
        </ul>
        {error && (
          <p role="alert" className="mt-2 px-1 text-xs text-danger">
            {error}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {/* One line in every state, so the buttons never move. */}
          <span role={parked ? 'status' : undefined} className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
            {busy ? 'Sending your answer…' : sent ? 'Answer sent — waiting for the agent to pick it up…' : active ? 'Number keys pick · Ctrl+Enter submits' : ''}
          </span>
          <Button variant="ghost" size="sm" disabled={parked} onClick={() => say(SKIP_MESSAGE)}>
            Skip
          </Button>
          <Button size="sm" disabled={parked || !ready} onClick={submit}>
            Submit
          </Button>
        </div>
      </div>
    </section>
  )
}
