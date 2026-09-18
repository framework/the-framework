import type { FrameworkEvent } from '../../src/index.js'

type EventKind = FrameworkEvent['kind']

// The badge next to each session-log line should read plainly to someone seeing the UI for the
// first time (#1035). Only the kinds whose raw name is internal jargon get a friendly word; every
// other kind reads as its own name. The badge is CSS-uppercased, so the values here stay lowercase.
const OVERRIDES: Partial<Record<EventKind, string>> = {
  driver: 'agent', // the AI turn: prompt sent, reply, turn complete
  usage: 'cost', // spend so far
  'session-update': 'resume', // the resumable session id + link
}

/** The plain-language badge label for a session-log event kind. */
export function eventKindLabel(kind: EventKind): string {
  return OVERRIDES[kind] ?? kind
}
