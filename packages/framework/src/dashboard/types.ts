import type { LinkedPr } from './gh.js'

// The dashboard's request/result vocabulary (#345/#396/#475): the shapes the Start / Add /
// Preview RPCs speak. They live here, on neither the HTTP server nor the RPC mount, so both —
// plus the RPCs themselves — depend on this leaf rather than on each other.

/** The outcome of removing a retained worktree (#737). */
export type RemoveWorktreeResult = { ok: true } | { ok: false; error: string }

/** The outcome of deleting a session — its records and worktree (#1032). */
export type DeleteAgentResult = { ok: true } | { ok: false; error: string }

/** The outcome of an add-project attempt (#396): registered, or was already, or why not. */
export type AddProjectResult =
  | { ok: true; alreadyActivated: boolean }
  | { ok: false; error: string }

/**
 * What the Onboarding checklist (#958) needs and no other read carries: the server's own
 * working directory, offered as the one-click first project.
 *
 * Both fields are null where adding projects is not wired (the relay), so a public host
 * never discloses its filesystem layout.
 */
export interface OnboardingSuggestion {
  /** The server's working directory, or null when it cannot be offered. */
  cwd: string | null
  /** The project id for {@link cwd} when it is already registered, else null. */
  cwdProjectId: string | null
}

/**
 * What a Start carries besides its prompt (#1774): the person's picks, handed to the project's
 * `start` hook line as `DRIVER` and `MODEL`. Absent leaves each to the tool the line names.
 */
export interface StartAgentOptions {
  /** The model to run on. */
  model?: string
  /** Which coding agent the run is on: `claude-code` or `codex`. */
  driver?: string
  /**
   * Run this session on a connected device (#1067): the local daemon relays the start to the remote
   * daemon at `url` (authenticating with `token` as the `fw_daemon` cookie) and streams its events
   * back into the local agent view. The device `label` rides along (memory-only, like `url`/`token`) so
   * the local session list + notice can show which device the agent is on after a reload (#1077).
   * Memory-only relay config the dashboard sets at submit time from a saved device. NEVER persisted to
   * Preferences or the registry: a device token is a per-browser secret. Absent = run locally.
   * Stripped before the start is forwarded, so the remote starts an ordinary local run and does not
   * relay onward.
   */
  remote?: { url: string; token: string; label?: string }
}

/** The outcome of a Start attempt (#345): the id of the run the project's start hook began, or why there is none. */
export type StartAgentResult = { ok: true; agentId: string } | { ok: false; error: string }

/**
 * Where a session is working (#798): the checkout, its branch, and what it is holding. Read by
 * the dashboard so a session's action bar can say which worktree it has, rather than leaving the
 * user to infer it from an agent id.
 */
export interface AgentWorktree {
  /** Absolute path of the checkout this agent works in. */
  path: string
  /** True when it is the agent's own worktree; false when it fell back to the project's checkout. */
  own: boolean
  /** Uncommitted changes present in that checkout. */
  dirty: boolean
  /** The branch it is on, absent when the path is not a git repo. */
  branch?: string
  /** Size on disk, bytes. Only read once nothing is writing to it, and best-effort even then. */
  sizeBytes?: number
  /** The PR opened for this checkout's branch (#809), when there is one. */
  pr?: LinkedPr
  /** The PR is not known yet, rather than absent (#1028): the lookup is still running. */
  prPending?: boolean
}
