/**
 * Modes as conditional `.md` files (#244). A preset's content directory can hold
 * a base file plus mode variants that override it:
 *
 * ```text
 * loops/major-change.md            # base — no conditions, always eligible
 * loops/major-change.autopilot.md  # metadata.conditions: autopilot — wins when autopilot is active
 * ```
 *
 * A file's **stem** (its name up to the first `.`) is its identity; siblings that
 * share a stem are variants of one thing. A variant declares `metadata.conditions`
 * (a mode name or a list) and only becomes eligible when every one of those modes
 * is active. Among the eligible siblings the most specific one wins (the most
 * matched conditions), so an active-mode variant beats the base and the base is
 * the fallback when nothing matches.
 *
 * This is the simple frontmatter fan-out; real prompt composition from parameters
 * is the follow-up (#245) if the variant files get too duplicative.
 */

/** The filename stem before the first `.` — a file's identity for override grouping. */
export function stemOf(filename: string): string {
  return filename.replace(/\.md$/i, '').split('.')[0] ?? filename
}

/** Read `metadata.conditions` as a normalized list of mode names (empty for a base file). */
export function readConditions(meta: Record<string, unknown> | undefined): string[] {
  const c = meta?.['conditions']
  if (c == null) return []
  const list = Array.isArray(c) ? c : [c]
  return list.filter((x): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean)
}

/** A candidate file reduced to what override resolution needs. */
export interface Conditional {
  /** Grouping identity — usually {@link stemOf} of the filename. */
  readonly stem: string
  /** The modes that must all be active for this file to be eligible; empty = base. */
  readonly conditions: readonly string[]
}

/**
 * From a set of candidate files, keep one winner per stem for the active modes:
 * the most-specific eligible variant, falling back to the base. Input order is
 * preserved and used to break ties deterministically. Pure — no I/O.
 */
export function selectWinners<T extends Conditional>(entries: readonly T[], activeModes: readonly string[]): T[] {
  const active = new Set(activeModes)
  const groups = new Map<string, T[]>()
  for (const entry of entries) {
    const group = groups.get(entry.stem)
    if (group) group.push(entry)
    else groups.set(entry.stem, [entry])
  }

  const winners: T[] = []
  for (const group of groups.values()) {
    let best: T | undefined
    for (const entry of group) {
      if (!entry.conditions.every(c => active.has(c))) continue // not eligible
      if (!best || entry.conditions.length > best.conditions.length) best = entry
    }
    if (best) winners.push(best)
  }
  return winners
}
