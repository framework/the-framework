import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AutoPmReport, DriverQuotaWindow, QuotaBoundaryStatus, QuotaView } from '@gemstack/the-framework'
import { MAX_SPEND_OFFSET } from '@gemstack/the-framework/client'
import { useAutoPm, useQuota } from '../lib/quota.js'
import { formatRelative, formatUntil } from '../lib/format-date.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { weekDays, quotaTone, limitPercent, projectedRange, TONE_NOTE, type QuotaTone } from '../lib/quota-bar.js'
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

/** A swatch-and-word pair for the legend below the bar. */
function LegendItem({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      {swatch}
      {children}
    </span>
  )
}

/**
 * The week as one track, split in two (#960 Edit): what's already used, at full opacity, and the
 * room left before unattended work stops, dimmed — one bar read left-to-right rather than a used
 * amount plus a handle floating apart from it. Dragging the dim segment's own right edge is what
 * moves that stop, so the control is the bar's shape rather than a slider laid over it.
 *
 * The boundary is drawn at the step that actually gates the pace, not a smooth pro-rata line: it
 * steps a seventh at a time (#879), and a line the daemon does not act on would be a prettier lie.
 * The limit, by contrast, really is continuous — it is a handle, not a reading.
 */
function WeekBar({
  status,
  percentUsed,
  offset,
  onChangeOffset,
}: {
  status: QuotaBoundaryStatus
  percentUsed: number
  offset: number
  onChangeOffset: (offset: number) => void
}) {
  const { boundary } = status
  // Seven equal 24h stretches from the account's own start moment (#960 Edit), so each day is
  // shown once, centred in its own share of the bar — not walked from local midnight, which split
  // the start day into a sliver at each end and had to label both `TU`.
  const days = weekDays(boundary.startsAt, boundary.resetsAt)
  const tone = quotaTone(percentUsed, boundary.percent)
  const limit = limitPercent(boundary.percent, offset)
  const projected = projectedRange(percentUsed, limit)
  const label = `${Math.round(percentUsed)}% of the week used, against a boundary of ${Math.round(boundary.percent)}% on day ${boundary.day} of 7`

  return (
    <div className="space-y-1.5">
      {/* One label per day, centred in its own seventh of the bar. */}
      <div className="relative h-4 text-[10px] font-medium tracking-wide text-muted-foreground">
        {days.map(day => (
          <span key={day.label} className="absolute top-0 -translate-x-1/2" style={{ left: `${(day.startPercent + day.endPercent) / 2}%` }}>
            {day.label}
          </span>
        ))}
      </div>
      <div className="relative h-4">
        <div role="img" aria-label={label} className="absolute inset-x-0 top-[3px] h-2.5 overflow-hidden rounded-full bg-muted">
          {/* Used, at full opacity. */}
          <div className={cn('absolute inset-y-0 left-0 rounded-full', TONE_FILL[tone])} style={{ width: `${projected.start}%` }} />
          {/* The room left before unattended work stops — the same colour, dimmed, right after the
              used fill, so the two read as one bar split in two rather than a mark over it. */}
          {projected.end > projected.start && (
            <div
              className={cn('absolute inset-y-0 rounded-full opacity-35', TONE_FILL[tone])}
              style={{ left: `${projected.start}%`, width: `${projected.end - projected.start}%` }}
            />
          )}
          {/* The day delimiters — a notch through the fill at each day's own start. */}
          {days.slice(1).map(day => (
            <div key={`${day.label}-delim`} className="absolute inset-y-0 w-px bg-background/60" style={{ left: `${day.startPercent}%` }} aria-hidden />
          ))}
          {/* The boundary. Inside the same box as the fill, which is the whole point of one track. */}
          <div
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
            style={{ left: `${Math.min(Math.max(boundary.percent, 0), 100)}%` }}
            aria-hidden
          />
        </div>
        {/* The limit, as a real `<input type="range">` so it is draggable and keyboard-operable —
            but valued on the bar's own 0-100 scale rather than the offset's, so the thumb the
            browser draws lines up with the dimmed segment's own edge instead of a second,
            differently-scaled track. A native thumb's position is always (value - min) / (max -
            min) of the box, so min/max have to stay 0/100 exactly — anything narrower (say,
            clamped to the offset's own reach) would stretch that fraction and the thumb would
            drift from that edge instead of sitting on it. The ±MAX_SPEND_OFFSET reach is enforced
            in the change handler instead, on the offset it produces. Dragging it is what changes
            where the dimmed segment ends. */}
        <input
          id="spend-limit"
          type="range"
          aria-label="Unattended work stops at"
          className={cn(
            'absolute inset-0 h-full w-full cursor-grab appearance-none bg-transparent active:cursor-grabbing',
            '[&::-webkit-slider-runnable-track]:bg-transparent',
            '[&::-moz-range-track]:border-none [&::-moz-range-track]:bg-transparent',
            // A classic round knob, not the bracket-shaped mark this replaces — the split fill
            // beneath already shows the range it sets, so the thumb only needs to read as a handle.
            '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-sm',
            '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none',
            '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:shadow-sm',
          )}
          min={0}
          max={100}
          step="any"
          value={limit}
          onChange={e => {
            const rawOffset = Math.round(Number(e.target.value) - boundary.percent)
            onChangeOffset(Math.min(Math.max(rawOffset, -MAX_SPEND_OFFSET), MAX_SPEND_OFFSET))
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{Math.round(percentUsed)}% used</span>
        {' · '}
        {TONE_NOTE[tone]}
      </p>
      {/* Whether the knob has left any room to project (#960 Edit): dragged all the way down onto
          the used fill, there is nothing left for unattended work to spend, which is worth naming
          as its own state rather than leaving as a bar that merely looks empty. */}
      <p className="text-[11px] text-muted-foreground">
        {projected.end > projected.start ? (
          <>
            ✅ Autonomous AI <em>enabled</em> <small className="text-muted-foreground/70">move slider to the left to disable</small>
          </>
        ) : (
          <>
            ❌ Autonomous AI <em>disabled</em> <small className="text-muted-foreground/70">move slider to the right to enable</small>
          </>
        )}
      </p>
      {/* The legend (#960 Edit): what the two shades of the bar and its line mean. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <LegendItem swatch={<span className={cn('h-2 w-2 rounded-sm', TONE_FILL[tone])} aria-hidden />}>Used</LegendItem>
        <LegendItem swatch={<span className={cn('h-2 w-2 rounded-sm opacity-35', TONE_FILL[tone])} aria-hidden />}>Autonomous AI (projected)</LegendItem>
        <LegendItem swatch={<span className="h-2 w-0.5 bg-foreground" aria-hidden />}>Daily boundary</LegendItem>
      </div>
    </div>
  )
}

/**
 * The caption for the draggable limit on the bar above (#960 Edit): the control itself lives on
 * the week bar, so this is only the number and the sentence that make a drag distance readable.
 */
function SpendLimitCaption({ offset, boundaryPercent }: { offset: number; boundaryPercent: number }) {
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
      <p className="text-xs text-muted-foreground">
        {offset === 0
          ? 'Drag the handle on the bar above to move it — left holds unattended work back, right lets it borrow against the days still to come.'
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
        <CardTitle className="text-base">Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!view && <p className="text-sm text-muted-foreground">Reading your usage…</p>}

        {/* Without a placeable week there is no axis to draw. Say so, loudly — no fallback (Rom):
            this used to degrade to the week as a plain figure, which hid a real defect for weeks —
            a reset phrasing the parser didn't know just made the panel quietly plainer, and nothing
            anywhere said the boundary was gone. Quote the text that failed: it is the bug report. */}
        {view?.boundary && week ? (
          <WeekBar status={view.boundary} percentUsed={week.percentUsed} offset={offset} onChangeOffset={setOffset} />
        ) : view && view.windows.length ? (
          <p role="alert" className="text-sm text-danger">
            {week?.resetsAtText
              ? `Couldn't parse quota: the week resets “${week.resetsAtText}”, which isn't a phrasing this version recognizes.`
              : `Couldn't parse quota: the readout has no week this version can place.`}
          </p>
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

        {/* Only where the bar above is actually drawn: the handle lives on it, and a caption for a
            control that isn't on screen would name something the user cannot see. */}
        {view?.boundary && week ? (
          <div className="border-t border-border pt-3">
            <SpendLimitCaption offset={offset} boundaryPercent={view.boundary.boundary.percent} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
