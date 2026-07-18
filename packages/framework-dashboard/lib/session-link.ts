// Honest labeling for a run's "Open session" link. Only a URL that actually encodes the
// session id opens *this* session. A headless Claude Code run has no per-session URL — the
// framework defaults to the generic app entry point (claude.ai/code) as an "open the app"
// affordance — so surfacing it as "Open session (<id>)" wrongly implies the link resolves to
// that id. Here we detect the difference and describe the link honestly; the id, when it is
// not encoded in the URL, is returned separately so the UI can show it as plain text.

/** The minimal shape of `sessionInfo(events)` this needs, kept structural so it never
 *  couples to the framework's exact type. */
export interface SessionLike {
  sessionLink?: string | undefined
  sessionId?: string | undefined
  driver?: string | undefined
}

export interface SessionLinkView {
  /** The URL to open. */
  href: string
  /** The honest link text. */
  label: string
  /** The session id to show as separate text, or null when the link already encodes it. */
  id: string | null
}

/** Describe a run's session link, or null when there is no link to show. */
export function describeSessionLink(session?: SessionLike | null): SessionLinkView | null {
  const href = session?.sessionLink
  if (!href) return null
  const id = session?.sessionId
  const deep = Boolean(id && href.includes(id))
  const label = deep
    ? `Open session (${id}) ↗`
    : session?.driver === 'claude'
      ? 'Open Claude Code ↗'
      : 'Open session ↗'
  return { href, label, id: !deep && id ? id : null }
}
