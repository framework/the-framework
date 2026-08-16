import { useEffect, useRef, useState } from 'react'
import type { ChoiceRequest } from '../../dist/index.js'
import { sendChoice } from '../rpc/control.js'
import { useAction } from '../lib/use-action.js'
import { Button } from './ui/button.js'
import { Checkbox } from './ui/checkbox.js'
import { cn } from '../lib/utils.js'

// "Your call" — the interactive gate the agent parks on (#304/#332), rendered from the
// live event stream and posted back over the control RPC (rpc/control.ts) to the
// project's control.jsonl. One shape: a question with options, picked one at a time or
// several at once (#332). There were three — an Approve/Decline confirm got its own green and
// red buttons — but an approval is a question with two options, and rendering it as its own
// card only meant the agent had to know which of three blocks to emit. It always asks: a gate
// only reaches a panel when somebody is watching, and a session nobody is watching resolves
// its gates to the recommended option without one. The panel clears itself when the resulting
// `choice-resolved` event streams in
// (pendingChoices drops it); mount it with `key={choice.id}` so a re-fired gate resets state.
// `active` (the first gate in the right rail, #440) binds Ctrl+Enter to Accept.
export function ChoicePanel({
  projectId,
  agentId: agentId,
  choice,
  active = false,
  countdown = true,
  inline = false,
  onAnswered,
}: {
  projectId: string
  /** Which run the pick resolves (#749); absent falls back to the project's control log. */
  agentId?: string | null | undefined
  choice: ChoiceRequest
  active?: boolean
  /** Inline in the transcript (#1455 item 6): a rounded card in the flow rather than a
   *  full-bleed rail section. Behaviour is identical — only the container changes. */
  inline?: boolean
  /**
   * Whether autopilot's auto-accept countdown may run here (#1455). The launcher's questions hub
   * turns it off: it renders every parked session's gate at once, and a page that answers all of
   * them ten seconds after being opened is not a hub, it is a mass auto-accept. The session's own
   * rail keeps the countdown — there the user chose to look at that one agent.
   */
  countdown?: boolean
  /**
   * Told once the pick is posted and accepted, with what was picked. The launcher's hub uses it
   * to collapse the answered card to a single line (#1455 bonus 2); the rail passes nothing —
   * there the `choice-resolved` event unmounts the panel and that is the whole story.
   */
  onAnswered?: ((pick: string | string[]) => void) | undefined
}) {
  const { busy, error, run } = useAction()
  // Posted and accepted by the daemon; the panel stays parked (buttons off, status shown)
  // until the `choice-resolved` event unmounts it (#948) — before, the buttons just greyed
  // out with no word on why.
  const [sent, setSent] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(choice.multi ? choice.options.filter(o => o.default).map(o => o.id) : []),
  )
  // The countdown's auto-accept fires from a closure captured when the countdown started;
  // the ref keeps it reading the boxes as they are at fire time (#948).
  const checkedRef = useRef(checked)
  checkedRef.current = checked
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [cancelled, setCancelled] = useState(false)

  const parked = busy || sent

  const post = (pick: string | string[], by: 'user' | 'autopilot' = 'user') => {
    void run(() => sendChoice(projectId, choice.id, pick, by, agentId ?? undefined), 'Could not send your choice — try again.').then(
      result => {
        if (result !== undefined) {
          setSent(true)
          onAnswered?.(pick)
        }
      },
    )
  }

  const toggle = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // What Accept picks: the checked subset for a multi-select, else the recommended option (the
  // first when the agent named none). Shared by the button, the countdown, and Ctrl+Enter.
  const recommendedId = choice.recommended ?? choice.options[0]?.id
  const autoPick = (): string | string[] => (choice.multi ? [...checkedRef.current] : (recommendedId ?? ''))
  const accept = (by: 'user' | 'autopilot' = 'user') => post(autoPick(), by)

  // Any mouse movement cancels the auto-accept — the human is here, so let them pick.
  useEffect(() => {
    const cancel = () => setCancelled(true)
    window.addEventListener('mousemove', cancel, { once: true })
    return () => window.removeEventListener('mousemove', cancel)
  }, [])

  // Ctrl+Enter accepts the recommended pick (page.ts parity, #440). Only the active gate
  // (the first in the rail) binds it, so the shortcut is unambiguous with several gates open.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !parked) {
        e.preventDefault()
        accept()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, parked])


  return (
    <section
      role="region"
      aria-label={choice.title}
      className={inline ? 'rounded-md border border-border bg-accent/40 p-3' : 'border-b border-border bg-accent/40 p-4'}
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your call</div>
      <h2 className="mb-3 text-sm font-medium">{choice.title}</h2>

      {choice.multi ? (
        <>
          <ul className="mb-3 space-y-1">
            {choice.options.map(o => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox className="mt-0.5" checked={checked.has(o.id)} onCheckedChange={() => toggle(o.id)} disabled={parked} />
                  <span>
                    {o.label}
                    {o.detail && <span className="block text-xs text-muted-foreground">{o.detail}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {/* The label says what Accept will post, so an empty pick is a choice, not a surprise. */}
          <Button disabled={parked} onClick={() => post([...checked])}>
            {checked.size === 0 ? 'Accept none' : `Accept ${checked.size} selected`}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {choice.options.map(o => (
            <Button
              key={o.id}
              variant={o.id === choice.recommended ? 'default' : 'outline'}
              className={cn('h-auto flex-col items-start gap-0.5 py-2 text-left')}
              disabled={parked}
              onClick={() => post(o.id)}
            >
              <span className="font-medium">
                {o.label}
                {o.id === choice.recommended && <span className="ml-2 text-xs font-normal opacity-80">Recommended</span>}
              </span>
              {o.detail && <span className="text-xs font-normal opacity-80">{o.detail}</span>}
            </Button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {parked ? (
          <span role="status">{busy ? 'Sending your choice…' : 'Choice sent — waiting for the agent to pick it up…'}</span>
        ) : (
          <>{active && <span className="ml-auto">Ctrl+Enter to accept</span>}</>
        )}
      </div>
    </section>
  )
}
