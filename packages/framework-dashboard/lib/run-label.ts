import type { RunMeta } from '@gemstack/the-framework'
import { formatDateTimeShort } from './format-date.js'

// What to call a session in a list.
//
// `intent` is what the user typed, and it is often absent: a session started from a preset or
// resumed from the CLI never records one. The rail used to print a bold "(no prompt)" for those
// and push the one fact that did identify them, the timestamp, into small muted text beside it.
// So the loudest thing on most rows said nothing, and the rows were told apart by the quietest.
//
// The fallbacks in order: the agent's own name for the session (#326, also its branch), then the
// branch its work landed on, then when nothing describes the run, the time it started. A date is
// a poor name but a real one, and it belongs on the line that identifies the row.
export function runLabel(run: Pick<RunMeta, 'intent' | 'sessionName' | 'branch' | 'startedAt'>): string {
  return run.intent?.trim() || run.sessionName?.trim() || run.branch?.trim() || formatDateTimeShort(run.startedAt)
}
