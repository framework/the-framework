import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The prompt analysis a session writes at its worktree root (#1180): the system prompt has the
 * agent create `ANALYSIS_RESULT.md` ("Analyze the user prompt … create ANALYSIS_RESULT.md that
 * lists the analysis results") before it starts work. The file is gitignored and free-form — a
 * markdown list in practice — so the dashboard reads it forgivingly: each fact is optional, and
 * a file carrying none of them reads as no analysis at all.
 */
export interface RunAnalysis {
  /** How big the agent judged the work: "small", "large", "very large". */
  scope?: string
  /** How settled the approach is: whether the problems had one obvious solution. */
  variability?: string
  /** Whether the work includes a plan (a `PLAN_<session>.agent.md` was written). */
  plan?: 'yes' | 'no'
  /** Whether the work spans over new tickets (a backlog was written). */
  newTickets?: 'yes' | 'no'
}

/** The filename the system prompt dictates; also the root .gitignore's `ANALYSIS_RESULT.md` entry. */
const ANALYSIS_FILENAME = 'ANALYSIS_RESULT.md'

/** Scan cap: the file is a handful of lines; a runaway one is not worth reading past this. */
const MAX_SCAN_BYTES = 65_536

/**
 * A fact line: an optional list marker, an optionally-emphasised key, a colon, the value.
 * Matches `- Scope: small`, `**Variability**: low`, `2. New tickets: no`, and plain
 * `Plan: yes` alike. A key running on into other word characters (`Planning:`) does not match.
 */
const FACT_LINE = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?[*_`]{0,3}(scope|variability|plan|new[\s_-]?tickets)[*_`]{0,3}\s*:\s*(.*)$/i

/**
 * The short word(s) the fact leads with: agents write `small — one dashboard feature: …`, so the
 * value is cut at the first delimiter and stripped of emphasis. A value that still is not short
 * after that ("it depends on how…") is not a scope word, and reads as absent rather than as a
 * truncated sentence in a badge.
 */
function shortValue(raw: string): string | undefined {
  const cut = raw.split(/[—–(),;.:]|\s-\s/)[0] ?? ''
  const cleaned = cut.replace(/[*_`[\]]/g, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return undefined
  if (cleaned.split(' ').length > 3 || cleaned.length > 32) return undefined
  return cleaned
}

/**
 * A yes/no fact, from however the agent phrased it: `NO`, `yes — see PLAN…`, `none`, `not
 * needed`. Anything that does not lead with an answer reads as absent, not as a guess.
 */
function yesNoValue(raw: string): 'yes' | 'no' | undefined {
  const cleaned = raw.replace(/[*_`[\]]/g, '').trim().toLowerCase()
  if (/^(yes|yep|true)\b/.test(cleaned)) return 'yes'
  if (/^(no|not|none|false|n\/a)\b/.test(cleaned)) return 'no'
  return undefined
}

/**
 * Parse the analysis facts out of the markdown, first parseable occurrence of each winning.
 * Deliberately tolerant, like the ticket reader's `describe`: the file is agent-written prose
 * following a loose instruction, so anything unreadable is dropped, never an error. Null when
 * no fact at all was found — the caller hides the whole strip rather than showing an empty one.
 */
export function parseAnalysisResult(md: string): RunAnalysis | null {
  const analysis: RunAnalysis = {}
  for (const line of md.slice(0, MAX_SCAN_BYTES).split('\n')) {
    const match = FACT_LINE.exec(line)
    if (!match) continue
    const key = match[1]!.toLowerCase().replace(/[\s_-]+/g, '')
    const raw = match[2]!
    if (key === 'scope') {
      if (analysis.scope === undefined) {
        const value = shortValue(raw)
        if (value !== undefined) analysis.scope = value
      }
    } else if (key === 'variability') {
      if (analysis.variability === undefined) {
        const value = shortValue(raw)
        if (value !== undefined) analysis.variability = value
      }
    } else if (key === 'plan') {
      if (analysis.plan === undefined) {
        const value = yesNoValue(raw)
        if (value !== undefined) analysis.plan = value
      }
    } else if (analysis.newTickets === undefined) {
      const value = yesNoValue(raw)
      if (value !== undefined) analysis.newTickets = value
    }
  }
  return Object.keys(analysis).length > 0 ? analysis : null
}

/**
 * Read a checkout's `ANALYSIS_RESULT.md` and parse it. Null when the file is absent or holds
 * nothing readable — for the dashboard those are the same fact: no analysis to show.
 */
export async function readAnalysisResult(cwd: string): Promise<RunAnalysis | null> {
  let md: string
  try {
    md = await readFile(join(cwd, ANALYSIS_FILENAME), 'utf8')
  } catch {
    return null
  }
  return parseAnalysisResult(md)
}
