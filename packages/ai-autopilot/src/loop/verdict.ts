/**
 * The verdict convention — a light, structured outcome a prompt can return so
 * the loop gates on *what a review concluded*, not just whether the prompt ran.
 *
 * A verdict is `{ blockers: string[] }`: an empty list means "nothing left to
 * fix" (passing); a non-empty list is the concrete work still required. The
 * production-grade checklist prompt returns one, and bootstrap's full-fledged
 * loop repeats against it until `blockers` is empty. This answers the note left
 * in the loop (#113): the v1 gate stopped on execution failure; a verdict lets it
 * stop on the review's outcome.
 *
 * The transport is text (prompts return text), so the convention is: end the
 * output with a fenced ```json block holding `{ "blockers": [...] }`.
 * {@link parseVerdict} reads it back; {@link isPassing} is the empty-blockers test.
 */

/** A structured prompt outcome the loop can gate on. */
export interface Verdict {
  /** Concrete work still required; empty means passing. */
  readonly blockers: string[]
  /** Optional free-text summary the agent may include. */
  readonly notes?: string
}

/** True when a verdict has no blockers left. A missing verdict is not passing. */
export function isPassing(verdict: Verdict | undefined): boolean {
  return verdict !== undefined && verdict.blockers.length === 0
}

// Matches fenced code blocks, capturing an optional language tag and the body.
const FENCE = /```(?:[a-zA-Z0-9]*)\n([\s\S]*?)```/g

/**
 * Parse a {@link Verdict} out of a prompt's text output. Reads the **last**
 * fenced code block that is a JSON object with a `blockers` array (last so a
 * later, corrected pass wins over an earlier draft in the same text), falling
 * back to a trailing bare `{ ... }` object. Returns `undefined` when no verdict
 * is present so the caller can tell "not passing" from "did not report".
 */
export function parseVerdict(text: string): Verdict | undefined {
  if (!text) return undefined

  const candidates: string[] = []
  for (const m of text.matchAll(FENCE)) candidates.push(m[1]!)

  // Later fences win, so scan from the end.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const verdict = coerce(candidates[i]!)
    if (verdict) return verdict
  }
  // Fallback — only when no fence parsed: a bare object somewhere in the text (the last
  // `{`-to-`}` run). Tried after the fences so brace-shaped prose trailing the real fenced
  // verdict can never outrank it.
  const lastOpen = text.lastIndexOf('{')
  const lastClose = text.lastIndexOf('}')
  if (lastOpen !== -1 && lastClose > lastOpen) return coerce(text.slice(lastOpen, lastClose + 1))
  return undefined
}

function coerce(raw: string): Verdict | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.trim())
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.blockers)) return undefined

  const blockers = obj.blockers.map(b => String(b).trim()).filter(Boolean)
  const notes = typeof obj.notes === 'string' && obj.notes.trim() ? obj.notes.trim() : undefined
  return Object.freeze({ blockers, ...(notes ? { notes } : {}) })
}
