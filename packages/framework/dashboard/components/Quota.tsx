import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import type { DriverQuotaWindow, QuotaBoundary, QuotaView } from '../../src/index.js'
import { useQuota } from '../lib/quota.js'
import { formatRelative, formatResetDay, formatResetTooltip, formatDuration, formatDurationLong } from '../lib/format-date.js'
import {
  weekDays,
  quotaTone,
  paceDeviationMs,
  consumedQuotaMs,
  paceSharePercent,
  type QuotaTone,
} from '../lib/quota-bar.js'
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

/**
 * Why the week could not be placed, said precisely enough to act on.
 *
 * There are three ways to get here and they need three different sentences — the panel's own rule
 * is that the error *is* the bug report, and a reader cannot report what the message will not name.
 * It used to have two, so the third case borrowed the wrong one: a week line carrying no reset
 * time fell through to "the readout has no week", which is false, and the readout below the alert
 * plainly showed the week it had just denied having.
 *
 * A reset-less week line is a normal shape, not a malformed one — `parseQuotaReadout` returns it
 * whenever Claude Code prints a window without its `· resets …` tail — and it is the shape an
 * untouched account is most likely to print, since there is nothing yet to count down from. So it
 * does not claim a parse failure either; it says what is missing and why that leaves nothing to draw.
 *
 * Deliberately no widening of the parser to make any of these cases go away. Which shape a given
 * account actually prints is not knowable from here, and the message naming what it saw is how
 * that gets reported back — a speculative extra label mapping would just swallow the evidence.
 */
function unplaceableWeek(week: DriverQuotaWindow | undefined, windows: DriverQuotaWindow[]): string {
  const listed = windows.map(w => `“${w.label}”`).join(', ')
  if (!week) return `Couldn't parse quota: no “Current week (all models)” line in the readout — it reported ${listed}.`
  if (!week.resetsAtText) {
    // Not "couldn't parse": this readout parsed exactly as printed. The week simply arrived
    // without a reset, and the bar is a pace comparison — it needs both ends of the span.
    return (
      `No quota week to place: “${week.label}” reports ${week.percentUsed}% used but no reset time, ` +
      `and the week is drawn between its start and its reset — there is no span to place it in.`
    )
  }
  return `Couldn't parse quota: the week resets “${week.resetsAtText}”, which isn't a phrasing this version recognizes.`
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
 * The week as one track: what's already used, filled, and the quota boundary as a mark through it.
 * The boundary is drawn exactly where it is now — continuous, not a value that jumps once a day —
 * so its position on the bar always names the actual instant `now` falls on.
 */
function WeekBar({ boundary, percentUsed, others }: { boundary: QuotaBoundary; percentUsed: number; others: DriverQuotaWindow[] }) {
  // Calendar days (#960 Edit): each segment's width is how much of that day is actually in the
  // week, so the axis places a label where most of that day falls rather than at a fixed seventh
  // regardless of the clock. A mid-day start still leaves one day split into two same-named
  // slivers straddling the reset — see {@link weekDays} — and only the larger keeps its label.
  const days = weekDays(boundary.startsAt, boundary.resetsAt)
  const tone = quotaTone(percentUsed, boundary.percent)
  const label = `${Math.round(percentUsed)}% of the week used, against a boundary of ${Math.round(boundary.percent)}% on day ${boundary.day} of 7`
  // How far ahead of or behind the boundary's own pace consumption is, as a duration (#960 Edit):
  // "53% used" said almost nothing about whether today's pace was being kept; "2h" does.
  const weekMs = boundary.resetsAt - boundary.startsAt
  const deviationMs = paceDeviationMs(percentUsed, boundary.percent, weekMs)
  const over = deviationMs >= 0
  const consuming = over ? 'Over-consuming' : 'Under-consuming'
  // The two readings #1367 asked for, beside the deviation rather than instead of it: what has
  // been spent as quota *time*, and what it is as a share of the allowance elapsed so far. The
  // dollar figure alone says nothing about whether today's rate is sustainable, and a share of the
  // week answers "how much is left" rather than "am I burning it too fast".
  const consumedMs = consumedQuotaMs(percentUsed, weekMs)
  const paceShare = paceSharePercent(percentUsed, boundary.percent)

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
          {/* Used, clamped to the bar: a window reporting over 100% has spent its week, not more. */}
          <div className={cn('absolute inset-y-0 left-0', TONE_FILL[tone])} style={{ width: `${Math.min(Math.max(percentUsed, 0), 100)}%` }} />
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
          <TooltipTrigger render={<span className="cursor-default" />}>
            <span className="font-medium">{formatDuration(consumedMs)}</span> spent
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            {formatDurationLong(consumedMs)} of the week's allowance has been consumed — {Math.round(percentUsed)}% of it, said
            in the same unit as the pace figure beside it.
          </TooltipContent>
        </Tooltip>
        {/* Absent for the first moments of the week, where the allowance so far is zero and every
            amount is infinitely above it. */}
        {paceShare !== undefined && (
          <>
            {SEP}
            <Tooltip>
              <TooltipTrigger render={<span className="cursor-default" />}>
                <span className={cn('font-medium', TONE_TEXT[tone])}>{Math.round(paceShare)}%</span> of pace
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Against the {Math.round(boundary.percent)}% of the week allowed by day {boundary.day} of 7 — 100% is exactly on
                pace.
              </TooltipContent>
            </Tooltip>
          </>
        )}
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
      {/* The legend. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <LegendItem swatch={<span className={cn('h-2 w-2 rounded-sm', TONE_FILL[tone])} aria-hidden />}>Used</LegendItem>
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

export function Quota() {
  const view = useQuota()
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
          <WeekBar boundary={view.boundary} percentUsed={week.percentUsed} others={others} />
        ) : view && view.windows.length ? (
          <p role="alert" className="text-sm text-danger">
            {unplaceableWeek(week, others)}
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
