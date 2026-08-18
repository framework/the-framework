import type { HandoffLevel } from '../handoff-level.js'
import type { AgentLocation } from '../agent-location.js'
import type { LinkedPr } from './gh.js'

// The dashboard's request/result vocabulary (#345/#396/#475): the shapes the Start / Add /
// Preview RPCs speak. They live here, on neither the HTTP server nor the RPC mount, so both —
// plus the RPCs themselves — depend on this leaf rather than on each other.

/** The outcome of removing a retained worktree (#737). */
export type RemoveWorktreeResult = { ok: true } | { ok: false; error: string }

/** The outcome of deleting a session — its records and worktree (#1032). */
export type DeleteAgentResult = { ok: true } | { ok: false; error: string }

/** The outcome of an add-project attempt (#396). */
export type AddProjectResult =
  | { ok: true; added: number; alreadyActivated: number }
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
 * Whether the picked driver's CLI can start an agent (#1326), as the launcher needs to hear it:
 * what is wrong and what fixes it, never what is right. Both lists are already written for a
 * human, so the warning renders them rather than mapping codes to copy.
 */
export interface DriverReady {
  /** False when a Start would die before the session exists. */
  ok: boolean
  /** Blocking problems, each naming its own fix. Empty when {@link ok}. */
  problems: string[]
  /** Non-blocking warnings, chiefly running as root, which breaks every agent identically. */
  warnings: string[]
}

/**
 * The dashboard's Global options (#314), posted alongside a Start and carried to
 * the spawned session on its spec (D4). Absent fields default off, i.e. today's
 * behavior — except where a field's own doc says the repo file decides.
 */
export interface StartAgentOptions {
  /** Remove the built-in #326 system prompt entirely (keeps the emit contract so the dashboard still drives it). */
  vanilla?: boolean
  /** Transparent mode (#625): run the wrapped agent fully raw (no framework system prompt, guard, dashboard, or TODO loop). */
  transparent?: boolean
  /** In-context directories (#439): each becomes a `Context:` line for the spawned agent. */
  context?: string[]
  /** On-before-mergeable prompt (#326): on setReadyForMerge(), queue the quality follow-ups as TODO entries. */
  onBeforeMergeable?: boolean
  /** Give the agent a real browser via chrome-devtools-mcp during the agent (#452). */
  browser?: boolean
  /**
   * How far this session publishes itself when it finishes (#1102/#1216/B5): `local`, `push`, `pr`
   * or `merge`. Absent leaves it to the repo file, then the default (`pr`) — which is what makes
   * the handoff zero-config.
   */
  handoff?: HandoffLevel
  /** The model to run the wrapped agent on (#628). Absent = the driver's own default. */
  model?: string
  /** Which coding agent drives the agent (#650): `claude` or `codex`. Absent = the default (`claude`). */
  driver?: string
  /** Where this run executes (#1050/#610): `local` (this device, the default), `actions` (a fresh GitHub Actions runner via ActionsDriver) or `web` (a Claude Code cloud session via CloudDriver). Absent = local, i.e. today's behavior. */
  target?: AgentLocation
  /**
   * Nobody is watching this agent (#846): its choice gates take the recommended option instead of
   * parking for an answer, which is the fallback a fully headless agent already uses and the one
   * autopilot would have clicked. It also keeps the agent out of the stay-open chat loop, so it
   * ends at settle and its armed handoff fires. Set by the work the daemon starts on its own
   * (auto PM, #685) and by dashboard surfaces that fire routine/preset work (#1279).
   * Stop still works — that aborts the agent controller, not a gate.
   */
  unattended?: boolean
  /**
   * The `tickets/<file>.md` this agent implements (#1117). Set by the daemon
   * when it starts a drain agent and the queue entry it will work links back to a ticket, so the
   * Overview can show that ticket as being implemented rather than guessing from its plan.
   */
  ticket?: string
  /**
   * This agent plans its {@link ticket} rather than implementing it. Set by
   * the daemon on a fanned-out [Plan tickets] run (#1327), whose PR lands only the plan: the
   * ticket still rides for the agent's meta, but the PR title must not inherit the issue as
   * `(fix #42)` (#1334) — a plan's merge would close the issue with the work still undone.
   */
  planAgent?: boolean
  /** Resume a finished agent's conversation (#720): its captured agent session id. The agent's prompt continues that session (full prior context) instead of starting fresh. Sent with `kind: 'prompt'` when you message an agent that has ended. */
  resumeSession?: string
  /**
   * Continue this agent rather than starting a new one (#762): the follow-up writes into that agent's
   * own log, on its own branch, so a stopped agent you message again stays one row in the history
   * instead of spawning an unrelated-looking second one.
   */
  continueAgentId?: string
  /**
   * Run this session on a connected device (#1067): the local daemon relays the agent to the remote
   * daemon at `url` (authenticating with `token` as the `fw_daemon` cookie) and streams its events
   * back into the local agent view. The device `label` rides along (memory-only, like `url`/`token`) so
   * the local session list + notice can show which device the agent is on after a reload (#1077).
   * Memory-only relay config the dashboard sets at submit time from a saved device. NEVER persisted to
   * Preferences or the registry, and never a CLI flag: a device token is a per-browser secret. Absent =
   * run locally, exactly as today. Stripped before the agent is forwarded, so the remote starts an
   * ordinary local run and does not relay onward.
   */
  remote?: { url: string; token: string; label?: string }
}

/**
 * What a dashboard Start spawns (#345/#331/#353): `build` is the normal framework
 * run; `prompt` runs the posted text verbatim through the direct path — what the
 * page sends after a preset prefilled (and the user possibly edited) the textarea;
 * `research` renders the [Research] preset around the posted "what" server-side
 * (empty allowed, defaults to `this PR`) and remains for API callers.
 */
export type StartAgentKind = 'build' | 'research' | 'prompt'

/** The outcome of a Start attempt (#345). */
export type StartAgentResult =
  /**
   * `agentId` is the id the daemon allocated for the agent (#761), present whenever it got its own
   * worktree. The dashboard needs it to select the agent it just started: with concurrent agents
   * (#736) it can no longer find that agent by looking for "the running one", because the previous
   * run is still running and the new one has not written its `agent.json` yet.
   */
  | { ok: true; agentId?: string }
  | { ok: false; busy?: boolean; error: string }

/** The outcome of a Preview attempt (#475): the live URL, or why not. */
export type PreviewResult =
  | { ok: true; url: string; command: string }
  | { ok: false; error: string }

/** Whether a project's Preview is running, and where (#475). */
export interface PreviewStatus {
  running: boolean
  url?: string
  command?: string
}

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
