import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import type { DriverQuotaWindow, QuotaBoundaryStatus, QuotaView } from '@gemstack/the-framework'
import { MAX_SPEND_OFFSET, DEFAULT_SPEND_OFFSET } from '@gemstack/the-framework/client'
import { useQuota } from '../lib/quota.js'
import { formatRelative, formatResetDay, formatResetTooltip, formatDuration, formatDurationLong } from '../lib/format-date.js'
import { updatePreferences } from '../lib/preferences.js'
import { weekDays, quotaTone, limitPercent, projectedRange, paceDeviationMs, ONE_DAY_PERCENT, type QuotaTone } from '../lib/quota-bar.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
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

/** Same scale, as text — the pace-deviation duration is coloured to match the bar it is about. */
const TONE_TEXT: Record<QuotaTone, string> = {
  under: 'text-success',
  near: 'text-info',
  over: 'text-warning',
  full: 'text-danger',
}

const SEP = ' — '

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
  others,
}: {
  status: QuotaBoundaryStatus
  percentUsed: number
  offset: number
  onChangeOffset: (offset: number) => void
  others: DriverQuotaWindow[]
}) {
  const { boundary } = status
  // Calendar days (#960 Edit): each segment's width is how much of that day is actually in the
  // week, so the axis places a label where most of that day falls rather than at a fixed seventh
  // regardless of the clock. A mid-day start still leaves one day split into two same-named
  // slivers straddling the reset — see {@link weekDays} — and only the larger keeps its label.
  const days = weekDays(boundary.startsAt, boundary.resetsAt)
  const tone = quotaTone(percentUsed, boundary.percent)
  const limit = limitPercent(boundary.percent, offset)
  const projected = projectedRange(percentUsed, limit)
  const enabled = projected.end > projected.start
  // How far ahead of the boundary's own pace the knob itself sits, as a duration — the same
  // arithmetic as the main figure's deviation, but of the limit rather than actual consumption.
  const limitDeviationMs = paceDeviationMs(limit, boundary.percent, boundary.resetsAt - boundary.startsAt)
  // A full day above the boundary, not merely past it — the boundary steps a day at a time on its
  // own, so a knob resting a few points ahead is normal and only worth flagging once it clears a
  // whole day's worth of pace.
  const eagerConsumption = limit > boundary.percent + ONE_DAY_PERCENT
  const label = `${Math.round(percentUsed)}% of the week used, against a boundary of ${Math.round(boundary.percent)}% on day ${boundary.day} of 7`
  // How far ahead of or behind the boundary's own pace consumption is, as a duration (#960 Edit):
  // "53% used" said almost nothing about whether today's pace was being kept; "2h" does.
  const deviationMs = paceDeviationMs(percentUsed, boundary.percent, boundary.resetsAt - boundary.startsAt)
  const over = deviationMs >= 0
  const consuming = over ? 'Over-consuming' : 'Under-consuming'

  return (
    <div className="space-y-1.5">
      {/* One label per day, centred in its own share of the bar. */}
      <div className="relative h-4 text-[10px] font-medium tracking-wide text-muted-foreground">
        {days.map(
          (day, i) =>
            day.label && (
              <span key={i} className="absolute top-0 -translate-x-1/2" style={{ left: `${(day.startPercent + day.endPercent) / 2}%` }}>
                {day.label}
              </span>
            ),
        )}
      </div>
      <div className="relative h-4">
        <div role="img" aria-label={label} className="absolute inset-x-0 top-[3px] h-2.5 overflow-hidden rounded-full bg-muted">
          {/* Used, at full opacity. No corner between it and the segment after it — one bar, not
              two pills glued together. */}
          <div className={cn('absolute inset-y-0 left-0', TONE_FILL[tone])} style={{ width: `${projected.start}%` }} />
          {/* The room left before unattended work stops — the same colour, dimmed, right after the
              used fill, so the two read as one bar split in two rather than a mark over it. */}
          {enabled && (
            <div
              className={cn('absolute inset-y-0 opacity-35', TONE_FILL[tone])}
              style={{ left: `${projected.start}%`, width: `${projected.end - projected.start}%` }}
            />
          )}
          {/* The day delimiters — a notch through the fill at each day's own start, white so it
              reads against every tone the fill can be. */}
          {days.slice(1).map((day, i) => (
            <div key={i} className="absolute inset-y-0 w-1 bg-background/60" style={{ left: `${day.startPercent}%` }} aria-hidden />
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
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-default" />}>
            {consuming}: <span className={cn('font-medium', TONE_TEXT[tone])}>{formatDuration(Math.abs(deviationMs))}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            You are {formatDurationLong(Math.abs(deviationMs))} {over ? 'above' : 'below'} the quota boundary.<br/><br/>You're{' '}
            {over ? 'over-consuming' : 'under-consuming'}: you spend {over ? 'faster' : 'slower'} than the week's pace allows.
          </TooltipContent>
        </Tooltip>
        {SEP}
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-default" />}>resets {formatResetDay(boundary.resetsAt)}</TooltipTrigger>
          <TooltipContent>{formatResetTooltip(boundary.resetsAt)}</TooltipContent>
        </Tooltip>
        {/* Only where there's something beyond the week this bar already is — a lone account week
            has nothing left for the tooltip to add. */}
        {others.length > 1 ? (
          <>
            {SEP}
            <Tooltip>
              <TooltipTrigger render={<span className="cursor-default" />}>show all limits</TooltipTrigger>
              <TooltipContent>
                {/* A table, not stacked flex rows — each column has to line up across every window,
                    which only a real table (rather than each row sizing its own two flex items)
                    guarantees. */}
                <table className="border-collapse text-left">
                  <tbody>
                    {others.map(w => (
                      <OtherWindowRow key={w.label} window={w} />
                    ))}
                  </tbody>
                </table>
              </TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </p>
      {/* The legend, and — on the same row (#960 Edit) — whether the knob has left any room to
          project. Grouped on the right since both describe the same knob: the warning first, since
          it explains why the state beside it might be worth a second look. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <LegendItem swatch={<span className={cn('h-2 w-2 rounded-sm', TONE_FILL[tone])} aria-hidden />}>Used</LegendItem>
          <LegendItem swatch={<span className={cn('h-2 w-2 rounded-sm opacity-35', TONE_FILL[tone])} aria-hidden />}>Budget for Autonomous AI</LegendItem>
          <LegendItem swatch={<span className="h-2 w-0.5 bg-foreground" aria-hidden />}>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex cursor-default items-center gap-0.5" />}>
                Quota boundary
                <CircleHelp className="h-3 w-3" aria-hidden />
              </TooltipTrigger>
              <TooltipContent className="max-w-64 space-y-2">
                <p>
                  Not a hard limit — just an indication of whether you're over- or under-consuming. It's calculated as a pro-rated share
                  of the weekly limit.
                </p>
                <p>If your usage matches the quota boundary, then you're spending exactly what the week's pace allows.</p>
                <p>Fun fact: the quota boundary is shown exactly at the current time in the week usage bar above.</p>
              </TooltipContent>
            </Tooltip>
          </LegendItem>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {eagerConsumption && (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex cursor-default items-center gap-0.5 text-warning" />}>
                ⚠️  Eager consumption
                <CircleHelp className="h-3 w-3" aria-hidden />
              </TooltipTrigger>
              <TooltipContent>Autonomous AI will spend tokens {formatDurationLong(limitDeviationMs)} faster than the week's pace allows</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger render={<span className="cursor-default" />}>
              {enabled ? (
                <>
                  ✅ Autonomous AI <em>enabled</em> <small className="text-muted-foreground/70">move slider to the left to disable</small>
                </>
              ) : (
                <>
                  ❌ Autonomous AI <em>disabled</em> <small className="text-muted-foreground/70">move slider to the right to enable</small>
                </>
              )}
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              {enabled
                ? 'Autonomous AI enabled means that agents will automatically work on tasks in the AI queue, and tasks will be automatically added to the AI queue.'
                : "Autonomous AI disabled means that agents won't automatically start to work — every new agentic work is triggered by you manually."}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

/**
 * The windows the bar is not about (the session, and a model's own week), as one line each — for
 * the fallback that draws these directly when there is no bar to tuck them behind.
 */
function OtherWindow({ window }: { window: DriverQuotaWindow }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{window.label}</span>
      <span className="text-muted-foreground">
        {Math.round(window.percentUsed)}% used{window.resetsAtText ? `${SEP}resets ${window.resetsAtText}` : ''}
      </span>
    </div>
  )
}

/** Same, as a table row for the "show all limits" tooltip, so every window's columns line up. */
function OtherWindowRow({ window }: { window: DriverQuotaWindow }) {
  return (
    <tr>
      <td className="pr-3 align-baseline text-muted-foreground">{window.label}</td>
      <td className="whitespace-nowrap align-baseline text-muted-foreground">
        {Math.round(window.percentUsed)}% used{window.resetsAtText ? `${SEP}resets ${window.resetsAtText}` : ''}
      </td>
    </tr>
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
  const [local, setLocal] = useState(serverOffset ?? DEFAULT_SPEND_OFFSET)
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

export function Quota() {
  const view = useQuota()
  const [offset, setOffset] = useSpendOffset(view?.boundary?.limit.offset)
  const note = view ? unavailableNote(view) : undefined
  // When the newest attempt failed but earlier numbers are still on screen, say how old they are.
  // A retained reading can now outlive several failures (#960), and an undated bar claims to be now.
  const staleAt = view?.unavailable !== undefined && view.windows.length > 0 ? view.readAt : undefined
  const week = view ? weekWindow(view.windows) : undefined
  // Every window, in the order Claude Code reports them — the session, the account's own week
  // (also drawn as the bar above, but worth its own line here too), and a model's own week.
  const others = view?.windows ?? []

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
          <WeekBar status={view.boundary} percentUsed={week.percentUsed} offset={offset} onChangeOffset={setOffset} others={others} />
        ) : view && view.windows.length ? (
          <p role="alert" className="text-sm text-danger">
            {week?.resetsAtText
              ? `Couldn't parse quota: the week resets “${week.resetsAtText}”, which isn't a phrasing this version recognizes.`
              : `Couldn't parse quota: the readout has no week this version can place.`}
          </p>
        ) : null}

        {/* Normally these live behind the bar's own "show all limits" tooltip — but without a bar
            to hide them in, they still have to show up somewhere; the windows Claude Code did
            report are data, not a fallback, and stay regardless. */}
        {!(view?.boundary && week) && others.length ? (
          <div className="space-y-1 border-t border-border pt-3">
            {others.map(w => (
              <OtherWindow key={w.label} window={w} />
            ))}
          </div>
        ) : null}

        {note ? (
          <p className="text-sm text-muted-foreground">
            {note}
            {staleAt !== undefined ? ` Last read ${formatRelative(new Date(staleAt).toISOString())}.` : ''}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
