import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Claude Code's folder trust, read (never written) for the dashboard (#1318).
 *
 * The CLI asks its one-time "do you trust this folder?" question interactively, which a
 * `--cloud` start under the daemon's pty can never answer (#1314) — a web agent on an
 * untrusted project is doomed before it starts. The dashboard can at least know that
 * before the agent is spent: this reads the CLI's own record of the decision.
 *
 * Read-only on purpose. Trusting a folder is a security decision the CLI owns; the
 * framework reports it and tells the user the one-time step, it does not make it for them.
 * Fail-quiet on an unexpected file: a missing, unreadable or reshaped `~/.claude.json`
 * answers "unknown", and the dashboard simply shows nothing extra.
 */

/** Where the Claude Code CLI records per-directory trust. */
function claudeConfigPath(home: string = homedir()): string {
  return join(home, '.claude.json')
}

/** What the dashboard knows about a root's trust. `known: false` means the file could not say. */
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
