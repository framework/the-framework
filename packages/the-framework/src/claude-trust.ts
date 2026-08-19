import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Claude Code's folder trust: read it, and grant it for a web run (#1493).
 *
 * The CLI asks its one-time "do you trust this folder?" question interactively, which a
 * `--cloud` start under the daemon's pty can never answer (#1314) — a web agent on an
 * untrusted project was doomed before it started. Trust was read-only here at first
 * (#1318: warn in the dashboard, name the one-time manual step), but any manual setup
 * step breaks the "click and it works" story for web runs, so #1493 reversed that
 * decision: the framework now writes the CLI's own trust record before the hand-off.
 * Starting a web agent on a project is itself a trust decision by the user — the write
 * automates consent already given, it does not invent it.
 *
 * Reading stays fail-quiet: a missing, unreadable or reshaped `~/.claude.json` answers
 * "unknown". Writing is the opposite — an existing file that does not parse is left
 * alone (throw, never destroy the CLI's config), and the caller falls back to the
 * interactive-advice path.
 */

/** Where the Claude Code CLI records per-directory trust. */
function claudeConfigPath(home: string = homedir()): string {
  return join(home, '.claude.json')
}

/** What is known about a root's trust. `known: false` means the file could not say. */
export interface ClaudeTrust {
  known: boolean
  trusted: boolean
}

/** Whether the CLI trusts `root`. Unknown when the config is missing or not understood. */
export async function readClaudeTrust(root: string, path: string = claudeConfigPath()): Promise<ClaudeTrust> {
  let config: unknown
  try {
    config = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return { known: false, trusted: false }
  }
  if (typeof config !== 'object' || config === null) return { known: false, trusted: false }
  const projects = (config as Record<string, unknown>).projects
  if (typeof projects !== 'object' || projects === null || Array.isArray(projects)) return { known: false, trusted: false }
  const entry = (projects as Record<string, unknown>)[root]
  const trusted =
    typeof entry === 'object' && entry !== null && (entry as Record<string, unknown>).hasTrustDialogAccepted === true
  return { known: true, trusted }
}

/**
 * Record that the CLI can trust `root` (#1493): the exact record the CLI itself writes
 * when the user accepts its dialog, so the dialog never fires. Everything else in the
 * config — other projects, top-level settings, the entry's own sibling fields — is
 * preserved. A missing file is created; an existing file that does not parse is refused
 * with a throw rather than overwritten, since the file is the CLI's, not ours.
 */
export async function writeClaudeTrust(root: string, path: string = claudeConfigPath()): Promise<void> {
  let raw: string | undefined
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    // No file yet: create one carrying only the trust record; the CLI accepts and extends it.
  }
  let config: Record<string, unknown> = {}
  if (raw !== undefined) {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error(`[framework] ${path} exists but is not a JSON object`)
    config = parsed as Record<string, unknown>
  }
  const projects =
    typeof config.projects === 'object' && config.projects !== null && !Array.isArray(config.projects)
      ? (config.projects as Record<string, unknown>)
      : {}
  const entry = typeof projects[root] === 'object' && projects[root] !== null ? (projects[root] as Record<string, unknown>) : {}
  config.projects = { ...projects, [root]: { ...entry, hasTrustDialogAccepted: true } }
  await writeFile(path, JSON.stringify(config, null, 2), 'utf8')
}
