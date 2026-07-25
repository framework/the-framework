import { useEffect, useRef, useState } from 'react'
import type { AutoPmReport, DriverQuotaWindow, QuotaBoundaryStatus, QuotaView } from '@gemstack/the-framework'
import { MAX_SPEND_OFFSET } from '@gemstack/the-framework/client'
import { useAutoPm, useQuota } from '../lib/quota.js'
import { formatRelative, formatUntil } from '../lib/format-date.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { weekTicks, quotaTone, limitPercent, TONE_NOTE, type QuotaTone } from '../lib/quota-bar.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Checkbox } from './ui/checkbox.js'
import { cn } from '../lib/utils.js'

// The usage bar (#960): one week-long track, so "am I ahead or behind?" is a glance rather than a
// calculation. It replaces the pair of flat meters that came before (#519/#879), which showed the
// same two numbers with no shared axis — the account's week and the boundary were drawn as separate
// bars, so nothing on screen said the second was a line through the first.
//
// The week runs edge to edge: the left edge is when the account's quota week began, the right edge
// is when it resets. The fill is what has been spent, the `|` is the boundary — how much of it may
// be gone by now — and the colour is the two compared.

/** The bar's colour per tone. Fill and marker share a scale so the comparison reads at a glance. */
const TONE_FILL: Record<QuotaTone, string> = {
  under: 'bg-success',
  near: 'bg-info',
  over: 'bg-warning',
  full: 'bg-danger',
}

/** The account's own week: the window the bar is about. */
function weekWindow(windows: DriverQuotaWindow[]): DriverQuotaWindow | undefined {
  return windows.find(w => w.kind === 'week')
}

/**
 * The week as one track.
 *
 * The marker is drawn at the boundary that actually gates the work, not at a smooth pro-rata line:
 * the boundary steps a seventh at a time (#879), and drawing a line the daemon does not act on
 * would be a prettier lie.
 */
function WeekBar({ status, percentUsed, offset }: { status: QuotaBoundaryStatus; percentUsed: number; offset: number }) {
  const { boundary } = status
  const ticks = weekTicks(boundary.startsAt, boundary.resetsAt)
  const tone = quotaTone(percentUsed, boundary.percent)
  const label = `${Math.round(percentUsed)}% of the week used, against a boundary of ${Math.round(boundary.percent)}% on day ${boundary.day} of 7`

  return (
    <div className="space-y-1.5">
      {/* The day labels sit at each local midnight, so the start day appears at both ends when the
          week began mid-day — which is the normal case. */}
      <div className="relative h-4 text-[10px] font-medium tracking-wide text-muted-foreground">
        {ticks.map((tick, i) => (
          <span
            key={`${tick.label}-${i}`}
            className={cn('absolute top-0', tick.start ? 'left-0' : '-translate-x-1/2')}
            style={tick.start ? undefined : { left: `${tick.percent}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div role="img" aria-label={label} className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', TONE_FILL[tone])}
          style={{ width: `${Math.min(Math.max(percentUsed, 0), 100)}%` }}
        />
        {/* The boundary. Inside the same box as the fill, which is the whole point of one track. */}
        <div
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: `${Math.min(Math.max(boundary.percent, 0), 100)}%` }}
          aria-hidden
        />
        {/* Where unattended work actually stops, drawn only once it has been moved off the
            boundary — an unmoved limit is the boundary, and two marks on one pixel would read
            as a rendering fault rather than as agreement. */}
        {offset !== 0 && (
          <div
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 border-x border-foreground/70 bg-transparent"
            style={{ left: `${limitPercent(boundary.percent, offset)}%` }}
            aria-hidden
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{Math.round(percentUsed)}% used</span>
        {' · '}
        {TONE_NOTE[tone]}
      </p>
    </div>
  )
}

/**
 * The automatic-consumption limit, as a slider (#960).
 *
 * It sets an *offset* from the boundary, not an absolute percentage, so the limit travels with the
 * boundary through the week instead of being overtaken by it on day two. Centre is the default
 * policy: unattended work stops exactly where the account has spent its share of the week.
 */
function SpendLimit({ offset, boundaryPercent, onChange }: { offset: number; boundaryPercent: number; onChange: (offset: number) => void }) {
  const limit = limitPercent(boundaryPercent, offset)
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor="spend-limit" className="font-medium text-foreground">
          Unattended work stops at
        </label>
        <span className="text-xs text-muted-foreground">
          {Math.round(limit)}%{offset === 0 ? ' · the boundary' : ` · ${offset > 0 ? '+' : ''}${offset} on the boundary`}
        </span>
      </div>
      <input
        id="spend-limit"
        type="range"
        className="w-full accent-[var(--color-primary)]"
        min={-MAX_SPEND_OFFSET}
        max={MAX_SPEND_OFFSET}
        step={1}
        value={offset}
        onChange={e => onChange(Number(e.target.value))}
      />
      <p className="text-xs text-muted-foreground">
        {offset === 0
          ? 'Left of centre holds unattended work back; right of centre lets it borrow against the days still to come.'
          : offset > 0
            ? 'Unattended work may run ahead of the week, borrowing against the days still to come.'
            : 'Unattended work stands down before the week says it has to.'}
      </p>
    </div>
  )
}

/** The windows the bar is not about (the session, and a model's own week), as one line each. */
function OtherWindow({ window }: { window: DriverQuotaWindow }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{window.label}</span>
      <span className="text-muted-foreground">
        {Math.round(window.percentUsed)}% used{window.resetsAtText ? ` · resets ${window.resetsAtText}` : ''}
      </span>
    </div>
  )
}

/** Why there's no reading, in words a user can act on. */
function unavailableNote(view: QuotaView): string | undefined {
  switch (view.unavailable) {
    case undefined:
      return undefined
    case 'no-subscription':
      return 'This account has no subscription usage to report, so there is no boundary to measure against.'
    case 'agent-not-found':
      return 'Claude Code was not found, so usage cannot be read.'
    case 'unrecognized':
      // The poller no longer gives up on this (#960), so where a reading survives, say it is
      // behind rather than that the boundary is off, which read as terminal.
      return view.windows.length
        ? "Claude Code's latest usage readout wasn't one this version recognizes, so these numbers are from the reading before it."
        : 'Claude Code reported its usage in a way this version does not recognize. Trying again shortly.'
    default:
      return view.windows.length
        ? "Couldn't refresh just now, so these numbers may be a little behind."
        : 'Reading your usage now.'
  }
}

/**
 * The slider's position, held here rather than read straight off the poll.
 *
 * The stored value only comes back on the next quota read (30s), so a slider bound directly to it
 * snapped back after every keypress and each keypress recomputed from the same stale number:
 * twenty presses of the arrow key moved the limit by one. This keeps the user's value until the
 * daemon's catches up with it, which is the point at which the two agree anyway.
 */
function useSpendOffset(serverOffset: number | undefined): [number, (offset: number) => void] {
  const [local, setLocal] = useState(serverOffset ?? 0)
  // What we last wrote, while the poll is still behind it. `null` means "follow the server".
  const pending = useRef<number | null>(null)

  useEffect(() => {
    if (serverOffset === undefined) return
    if (pending.current !== null && pending.current !== serverOffset) return
    pending.current = null
    setLocal(serverOffset)
  }, [serverOffset])

  return [
    local,
    (offset: number) => {
      setLocal(offset)
      pending.current = offset
      void updatePreferences({ autoSpendOffset: offset })
    },
  ]
}

/** The repo a line is about, by the name you would call it: its directory. */
function projectName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/**
 * What the sweep last did (#1161). Without this the toggle was the only thing the panel could
 * say, so "on, and standing down because the queue could not be read" looked exactly like "on,
 * and quietly working" — and the reasons were already being written, to a log in a terminal the
 * dashboard user never sees.
 */
function AutoPmStatus({ report }: { report: AutoPmReport }) {
  // The box itself already says it is off, and a sweep's report on a preference it read as off
  // says nothing more than that.
  if (report.enabled === false) return null
  if (report.sweptAt === undefined) return <p className="text-xs text-muted-foreground">Checking…</p>
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p>
        Last checked {formatRelative(new Date(report.sweptAt).toISOString())} · next {formatUntil(report.nextSweepAt)}
      </p>
      {report.outcomes.length === 0 ? (
        <p>No projects to work on.</p>
      ) : (
        report.outcomes.map(outcome => (
          <p key={outcome.projectId}>
            <span className={cn(outcome.started && 'text-foreground')}>{projectName(outcome.path)}</span>
            {' — '}
            {outcome.message}
          </p>
        ))
      )}
    </div>
  )
}

export function Quota() {
  const view = useQuota()
  const autoPm = useAutoPm()
  const preferences = usePreferences()
  const [offset, setOffset] = useSpendOffset(view?.boundary?.limit.offset)
  const note = view ? unavailableNote(view) : undefined
  // When the newest attempt failed but earlier numbers are still on screen, say how old they are.
  // A retained reading can now outlive several failures (#960), and an undated bar claims to be now.
  const staleAt = view?.unavailable !== undefined && view.windows.length > 0 ? view.readAt : undefined
  const week = view ? weekWindow(view.windows) : undefined
  // Everything else: the session window, and a model's own week. Never the account week, which
  // the bar above already is.
  const others = view?.windows.filter(w => w !== week) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!view && <p className="text-sm text-muted-foreground">Reading your usage…</p>}

        {/* Without a placeable week there is no axis to draw, so fall back to the plain figure
            rather than an empty track, which would read as "nothing used". */}
        {view?.boundary && week ? (
          <WeekBar status={view.boundary} percentUsed={week.percentUsed} offset={offset} />
        ) : week ? (
          <OtherWindow window={week} />
        ) : null}

        {others.length ? <div className="space-y-1 border-t border-border pt-3">{others.map(w => <OtherWindow key={w.label} window={w} />)}</div> : null}

        {note ? (
          <p className="text-sm text-muted-foreground">
            {note}
            {staleAt !== undefined ? ` Last read ${formatRelative(new Date(staleAt).toISOString())}.` : ''}
          </p>
        ) : null}

        {view ? (
          <div className="space-y-1 border-t border-border pt-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm">
              <Checkbox
                checked={preferences.autoPm ?? false}
                onCheckedChange={checked => updatePreferences({ autoPm: checked })}
              />
              <span className="font-medium text-foreground">Spend what's left on the roadmap</span>
            </label>
            <p className="text-xs text-muted-foreground">
              When nothing is running, work the queue down and refill it rather than let the week's
              allowance expire. Only while the account is still under the line above.
            </p>
            {autoPm ? <AutoPmStatus report={autoPm} /> : null}
          </div>
        ) : null}

        {/* Only where there is a boundary to offset from: without one there is no line to move,
            and a slider over nothing would imply a limit that is not being applied. */}
        {view?.boundary ? (
          <div className="border-t border-border pt-3">
            <SpendLimit offset={offset} boundaryPercent={view.boundary.boundary.percent} onChange={setOffset} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
