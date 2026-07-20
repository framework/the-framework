import type { DriverQuotaWindow, QuotaBoundaryStatus, QuotaView } from '@gemstack/framework'
import { useQuota } from '../lib/quota.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { cn } from '../lib/utils.js'

// The usage panel (#519/#879): what the account has left, and how much of it The Framework
// may spend before it pauses itself. Two halves, because they answer different questions —
// "am I about to run out?" (the account's own windows) and "will my agents stop?" (the
// boundary). There is nothing to configure: the boundary is derived from the account's week.

/** A bar, or an explicit "we don't know" — never an empty bar, which would read as "nothing used". */
function Meter({ percent, muted }: { percent: number | undefined; muted?: boolean }) {
  if (percent === undefined) return <div className="h-1.5 rounded-full bg-muted" />
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', muted ? 'bg-muted-foreground/40' : 'bg-primary')}
        style={{ width: `${Math.max(percent, 1)}%` }}
      />
    </div>
  )
}

function AccountWindow({ window }: { window: DriverQuotaWindow }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{window.label}</span>
        <span className="text-xs text-muted-foreground">
          {window.percentUsed}% used{window.resetsAtText ? ` · resets ${window.resetsAtText}` : ''}
        </span>
      </div>
      <Meter percent={window.percentUsed} />
    </div>
  )
}

/** Where the boundary sits today, and whether the agents have reached it. */
function Boundary({ status }: { status: QuotaBoundaryStatus }) {
  const { boundary, reached } = status
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">Today's boundary</span>
        <span className="text-xs text-muted-foreground">
          day {boundary.day} of 7 · up to {Math.round(boundary.percent)}% of the week
        </span>
      </div>
      <Meter percent={boundary.percent} muted />
      <p className="text-xs text-muted-foreground">
        {reached
          ? `${reached.label} is ${Math.round(reached.percentUsed)}% used, so unattended work is paused until the boundary moves on.`
          : 'Your agents spend up to this line, so nothing is left on the floor and the last day of the week is all-out.'}
      </p>
    </div>
  )
}

/** Why there's no reading, in words a user can act on. */
function unavailableNote(view: QuotaView): string | undefined {
  switch (view.unavailable) {
    case undefined:
      return undefined
    case 'no-subscription':
      return "This account has no subscription usage to report, so there is no boundary to measure against."
    case 'agent-not-found':
      return 'Claude Code was not found, so usage cannot be read.'
    case 'unrecognized':
      return 'Claude Code reported its usage in a way this version does not recognize, so the boundary is off.'
    default:
      return view.windows.length
        ? "Couldn't refresh just now, so these numbers may be a little behind."
        : 'Reading your usage now.'
  }
}

export function UsagePanel() {
  const view = useQuota()
  const preferences = usePreferences()
  const note = view ? unavailableNote(view) : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!view && <p className="text-sm text-muted-foreground">Reading your usage…</p>}

        {view?.windows.length ? (
          <div className="space-y-3">{view.windows.map(w => <AccountWindow key={w.label} window={w} />)}</div>
        ) : null}

        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

        {view?.boundary ? (
          <div className="border-t pt-4">
            <Boundary status={view.boundary} />
          </div>
        ) : null}

        {view ? (
          <div className="space-y-1 border-t pt-4">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={preferences.autoPm ?? false}
                onChange={e => updatePreferences({ autoPm: e.target.checked })}
              />
              <span className="font-medium text-foreground">Spend what's left on the roadmap</span>
            </label>
            <p className="text-xs text-muted-foreground">
              When nothing is running, work the queue down and refill it rather than let the week's
              allowance expire. Only while the account is still under today's boundary.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
