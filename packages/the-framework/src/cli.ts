import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ClaudeCodeDriverOptions, type Driver, type DriverSession, type PermissionMode } from './driver/index.js'
import { AGENTS, AGENT_SPECS, isAgentName, type AgentName } from './agent.js'
import { createRunDriver } from './run-driver.js'
import { githubSlugFor } from './dashboard/github.js'
import { githubToken } from './dashboard/gh.js'
import type { ActionsDriverOptions } from './driver/index.js'
import { launchSharedBrowser, withBrowser, type SharedBrowser } from './browser.js'
import { connectCdp, startBrowserStream, type BrowserStream } from './browser-stream.js'
import { randomUUID } from 'node:crypto'
import { formatFrameworkEvent, mergeWithheldWhy } from './terminal.js'
import { CLAUDE_CODE_SESSION_LINK } from './session-link.js'
import { type AutoHandoffSkip, type ChoicePick, type ChoiceRequest, type FrameworkEvent, type MergeWithheldReason, type OnBeforeMergeableSkip } from './events.js'
import { runAutoHandoff, withheldMerge } from './dashboard/run-handoff.js'
import {
  runSession,
  type RunSessionOptions,
  type SessionKind,
} from './run.js'
import { FAKE_INTENT, fakeDriver } from './fake-script.js'
import { isTicketPath, ticketIssueRef } from './tickets.js'
import { isHandsOff, isRunLocation, type RunLocation } from './run-location.js'
import { handoffStages, isHandoffLevel, type HandoffLevel } from './handoff-level.js'
import { readSessionSpec, writeSessionSpec, type SessionSpec } from './session-spec.js'
import { sessionTodoPending } from './todo-loop.js'
import { loadFrameworkConfig, type FrameworkFileConfig } from './config.js'
import {
  describeResolvedConfig,
  fileConfigLayer,
  resolveRunConfig,
  type ConfigLayer,
  type ResolvedRunConfig,
} from './config-layers.js'
import { loadUserSystemPrompt, SYSTEM_PROMPT_FILE } from './system-prompt-file.js'
import { checkForUpdate, formatUpdateStatus, nodeVersionFetcher, type VersionFetcher } from './update-check.js'
import { appendLog, type LogEntry } from './logs.js'
import { appendMessage, isSafeVia } from './conversations.js'
import type { BindProjectDeps, RecordMessage } from './await-gate.js'
import { RunStore, commitPendingWork, currentBranch, nodeStoreFs, renameRunBranch, runBranchName, type StoreFs } from './store/index.js'
import { materializePresets } from './presets.js'
import { isLoopbackHost, registerHomeProject, runDaemon, DEFAULT_DAEMON_HOST, DEFAULT_DAEMON_PORT } from './daemon.js'
import { appendControl, resetControl, watchControl, type ControlWatcher } from './control.js'
import { RunMessageQueue } from './run-messages.js'
import { createGateKeepalive } from './gate-keepalive.js'
import { nodeGitRunner } from './project.js'
import { addProject, ensureDaemonToken, listProjects, readDaemonToken, readPreferences, resolveProjectPath } from './registry.js'
import { startConsumptionGuard } from './consumption-guard.js'
import { DEFAULT_SPEND_OFFSET } from './preference-defaults.js'
import {
  planMaintenanceSweep,
  maintainSweep,
  mergeMaintenanceState,
  short,
  type RepoReview,
} from './maintenance.js'
import {
  listProjectWorktrees,
  removeProjectWorktree,
  pruneProjectWorktrees,
} from './worktrees.js'
import { removeMergedWorktrees } from './merged-worktrees.js'
import { defaultWhat } from './preset-prompt.js'
import { renderOnBeforeMergeablePrompt, type OnBeforeMergeableContext } from './on-before-mergeable-prompt.js'
import { presets } from './preset-catalog.js'
import { errorMessage } from './error-message.js'

/**
 * The default link shown for a live run: the generic Claude Code entry point,
 * surfaced as "Open Claude Code" (not a per-run live session). We drive Claude
 * Code headless, which is not Remote-Controlled, so there is no per-session deep
 * link to construct (#214). Pass `--session-link "...{sessionId}..."` if you
 * wire up a real one.
 */
export const CLAUDE_CODE_SESSION_LIST = CLAUDE_CODE_SESSION_LINK

/**
 * The session link to show for a run: the user's `--session-link` if given, else
 * the generic Claude Code entry point for a live run (nothing for a fake one, which
 * has no real session). Pure, so the default is unit-testable without a live run.
 *
 * The default is Claude Code's *own* entry point, so it is only honest on a
 * Claude run: pointing a Codex session at claude.ai/code offers the user a link
 * to somewhere their run isn't. Codex keeps its sessions locally with nothing
 * equivalent to open, so another agent gets no default link at all (#542).
 */
export function chooseSessionLink(opts: Pick<SessionOptions, 'sessionLink' | 'agent'>, fake: boolean): string | undefined {
  if (opts.sessionLink) return opts.sessionLink
  return fake || opts.agent !== 'claude' ? undefined : CLAUDE_CODE_SESSION_LIST
}

/** Where the CLI writes. Injectable so tests capture output. */
export interface CliIO {
  out: (line: string) => void
  err: (line: string) => void
}

const defaultIO: CliIO = {
  out: line => process.stdout.write(line + '\n'),
  err: line => process.stderr.write(line + '\n'),
}

/**
 * The CLI version, read from the package's own `package.json` at runtime (#312).
 * The compiled entry lives one level under the package root (`dist/` or
 * `dist-test/`), so its `package.json` is always `../package.json`. Cached after
 * the first read; falls back to `unknown` if the file is somehow unreadable.
 */
let cachedVersion: string | undefined
export function frameworkVersion(): string {
  if (cachedVersion !== undefined) return cachedVersion
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    // `unknown`, not `0.0.0`: the packages are unreleased and legitimately versioned `0.0.0`, so a
    // numeric fallback would make a failed read indistinguishable from a correct one (#312).
    cachedVersion = pkg.version ?? 'unknown'
  } catch {
    cachedVersion = 'unknown'
  }
  return cachedVersion
}

const HELP = `The Framework — turnkey AI orchestration that wraps a coding agent (Claude Code or Codex).

Usage:
  framework              Serve the dashboard in the foreground. Ctrl+C closes it and every
                         session it is running; the server logs stream to this terminal.

Options:
  --port <n>             Dashboard port (default: 4200).
  --host <addr>          Bind address (default: 127.0.0.1, localhost only). A non-loopback
                         address (e.g. 0.0.0.0) exposes the dashboard to your network and
                         generates a shared token; the printed URL carries it, and any request
                         without it gets 401. Exposing a process spawner to the network is a
                         security decision (#806).
  -h, --help             Show this help.
  -v, --version          Print the version.

Everything else is the dashboard: it is the product's user interface, and where a session's
prompt, its options, its agent and its checkout are chosen. The dashboard spawns each session
as its own process, handing it one JSON spec rather than a command line.

The Framework drives the wrapped agent as a black box: it prompts, reads the code, and gates on
the outcome, then re-prompts. The dashboard foregrounds the loop status beside the agent's own
session.`

/**
 * One session's resolved configuration, as the run reads it (D4).
 *
 * These used to be command-line flags, which made every one of them a human surface as well as
 * the dashboard's process API. They arrive as a {@link SessionSpec} now — one JSON blob on a temp
 * file — so what is left here is a plain options object with no argv semantics: no tri-state
 * `--no-*` spellings, no mutual validation, no help text.
 */
export interface SessionOptions {
  /** The `FakeDriver` (`FRAMEWORK_FAKE=1`): an offline stand-in for the agent, for tests and e2e. */
  fake: boolean
  /** What the session was asked to do. */
  intent: string
  /** `--agent <claude|codex>`: which agent CLI drives the run (#542). Default `claude`. */
  agent: AgentName
  /** `--run-on <local|actions|web>` (#1050/#610): where the run executes. `actions` drives it on a
   * GitHub Actions runner via ActionsDriver (#934); `web` hands it to a Claude Code cloud session
   * via CloudDriver (#610); absent / `local` runs on this device as before. */
  target?: RunLocation | undefined
  cwd?: string | undefined
  /**
   * `--run-id <id>` (#736): the id the daemon allocated for this run before spawning it. Its
   * presence says the framework owns this run's checkout — `--cwd` is a worktree the daemon
   * created on a `the-framework/run-<id>` branch, which the run renames once the agent names
   * the session. Absent for a plain `framework "..."`, which runs in the user's own checkout.
   */
  runId?: string | undefined
  /**
   * `--continue-run` (#762): this run continues the run `--run-id` names rather than starting a new
   * one. The store reopens that run's log instead of truncating it, so messaging a stopped run
   * stays one row in the history.
   */
  continueRun?: boolean | undefined
  /**
   * `--topic` (#1120): this run is project-less. Set by the daemon when it spawns a topic run into a
   * neutral scratch `--cwd`; recorded on the run's meta so a reader can tell it from a project run.
   */
  topic?: boolean | undefined
  model?: string | undefined
  /** `--resume-session <id>` (#720): continue a finished run's agent session — the prompt resumes that conversation (full prior context). Set by the dashboard when you message a run that has ended. */
  resumeSession?: string | undefined
  /** `--via <surface>` (#917): the surface this run was started from, recorded on its conversation turns. Set by the daemon when a non-local surface (e.g. Discord) asked for the run. */
  via?: string | undefined
  /** `--ticket <path>` (#1117): the `tickets/<file>.md` this run is implementing. Set by the daemon when it starts a drain run, from the ticket its queue entry links to; recorded on the run's meta. */
  ticket?: string | undefined
  /** `--plan-run` (#1327): the `--ticket` is being planned, not implemented, so the PR title must not inherit its issue as `(fix #42)` (#1334) — the plan's merge would close the issue with the work still undone. */
  planRun?: boolean
  /** `--queue-entry <text>` (#1253): the one queue entry a routine drain pinned this run to; recorded on the run's meta so the sweep's claim outlives the daemon and the local process. */
  queueEntry?: string | undefined
  /** `--unattended`: no human is watching, so choice gates take the recommended option (#846). */
  unattended?: boolean
  scope: 'prototype' | 'full'
  preset?: string | undefined
  /**
   * The mode toggles are tri-state (#841): `undefined` is "this run said nothing", so the repo's
   * the-framework.yml decides, while an explicit `--no-*` turns the mode off over the file.
   */
  /** Remove the built-in #326 system prompt entirely, keeping the session controls (#314). */
  vanilla?: boolean | undefined
  /** `--transparent` (#625): run the wrapped agent fully raw — no framework system prompt, emit
   * protocols, consumption guard, dashboard, or TODO loop, so a run is identical to `claude -p`. */
  transparent?: boolean | undefined
  /** `--context <dir>` (repeatable): in-context directories added as one `Context:` line (#439). */
  context: string[]
  /** `--on-before-mergeable`: fire the #326 on-before-mergeable prompt when the run signals setReadyForMerge(), queueing the quality follow-ups as TODO entries. */
  onBeforeMergeable: boolean
  /** `--browser`: give the agent a real browser via chrome-devtools-mcp (navigate, console, network, DOM, screenshot) during the run (#452). */
  browser: boolean
  /**
   * How far this session publishes itself when it finishes (#1102/#1216/B5). `undefined` is "this
   * session said nothing", so the repo's the-framework.yml decides, and nobody setting it resolves
   * to `pr` — which is what makes the handoff zero-config.
   */
  handoff?: HandoffLevel | undefined
  buildEvent?: string | undefined
  maxCost?: number
  todoLoop: boolean
  todoMaxItems?: number
  sessionLink?: string | undefined
  /** Whether the session records itself to `.the-framework/`. Always true outside tests. */
  persist: boolean
  /** {@link SessionSpec.kind} `research`: run the Research preset as a direct prompt (#331). */
  research: boolean
  /** {@link SessionSpec.kind} `prompt`: run one prompt verbatim through the direct path (#353). */
  directPrompt: boolean
}

/** What the CLI itself accepts: four options, no verbs (D4). */
export interface CliArgs {
  help: boolean
  version: boolean
  /** `--port <n>`: the port the dashboard binds. Default {@link DEFAULT_DAEMON_PORT}; `0` is ephemeral. */
  port?: number
  /**
   * `--host <addr>` (#1051): the dashboard's bind address. Default loopback; a non-loopback
   * address exposes it to the network and gates every route behind the generated shared token.
   */
  host?: string
  /**
   * `--session <path>`: run the session described by the JSON spec at `path` (D4). The dashboard's
   * process API, not a human option — it is how one session is spawned, and the file is consumed.
   */
  session?: string
  error?: string
}

/**
 * Parse argv (without the node/script prefix). Pure and testable.
 *
 * Four options and nothing else. Everything a session needs used to be a flag here — sixty-seven
 * of them, twenty-seven with no human user at all, because the dashboard serialized
 * `StartRunOptions` onto a command line. Those travel as a {@link SessionSpec} now. `--host` and
 * `--port` survive because they are the two things a browser cannot be asked and a dashboard
 * cannot serve about itself; `--help` and `--version` because a command with options owes the
 * user both.
 */
export function parseArgs(argv: string[]): CliArgs {
  const opts: CliArgs = { help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true
        break
      case '--version':
      case '-v':
        opts.version = true
        break
      case '--port': {
        const n = Number(argv[++i])
        if (Number.isInteger(n) && n >= 0) opts.port = n
        else opts.error = 'invalid --port: must be a non-negative integer'
        break
      }
      case '--host': {
        const value = argv[++i]
        if (value === undefined) opts.error = 'invalid --host: missing address'
        else opts.host = value
        break
      }
      case '--session': {
        const value = argv[++i]
        if (value === undefined) opts.error = 'invalid --session: missing path'
        else opts.session = value
        break
      }
      default:
        opts.error = arg.startsWith('-') ? `unknown option: ${arg}` : `unknown command: ${arg}`
    }
  }
  return opts
}

/** The session defaults nothing sets any more, shared by {@link sessionOptions} and the tests. */
const SESSION_DEFAULTS = {
  agent: 'claude',
  scope: 'full',
  context: [],
  onBeforeMergeable: false,
  browser: false,
  persist: true,
  todoLoop: true,
} as const

/**
 * Read a session's options off the spec the dashboard wrote (D4).
 *
 * The handoff pair and the mode toggles are left unset when the spec says nothing about them, on
 * purpose: that is what lets the repo's `the-framework.yml` decide, with nobody setting them
 * resolving to on (#1102/#841). JSON distinguishes "absent" from `false` without needing a
 * `--no-*` spelling for each, which is the whole reason this stopped being an argv.
 */
export function sessionOptions(spec: SessionSpec, env: NodeJS.ProcessEnv = process.env): SessionOptions {
  const o = spec.options
  const defined = <T>(value: T | undefined): value is T => value !== undefined
  return {
    ...SESSION_DEFAULTS,
    context: o.context ?? [],
    fake: env['FRAMEWORK_FAKE'] === '1',
    intent: spec.prompt,
    research: spec.kind === 'research',
    directPrompt: spec.kind === 'prompt',
    cwd: spec.cwd,
    ...(spec.runId ? { runId: spec.runId } : {}),
    ...(spec.continueRun ? { continueRun: true } : {}),
    ...(spec.topic ? { topic: true } : {}),
    ...(isAgentName(o.agent) ? { agent: o.agent } : {}),
    ...(isRunLocation(o.target) ? { target: o.target } : {}),
    ...(o.model?.trim() ? { model: o.model.trim() } : {}),
    ...(o.resumeSession?.trim() ? { resumeSession: o.resumeSession.trim() } : {}),
    ...(o.via?.trim() ? { via: o.via.trim() } : {}),
    // The ticket comes off a queue file an agent writes, so it is re-checked here rather than
    // trusted: a path that is not a ticket never reaches the run (#1117).
    ...(o.ticket && isTicketPath(o.ticket) ? { ticket: o.ticket } : {}),
    ...(o.planRun ? { planRun: true } : {}),
    ...(o.queueEntry?.trim() ? { queueEntry: o.queueEntry } : {}),
    ...(o.unattended ? { unattended: true } : {}),
    ...(defined(o.vanilla) ? { vanilla: o.vanilla } : {}),
    ...(defined(o.transparent) ? { transparent: o.transparent } : {}),
    ...(isHandoffLevel(o.handoff) ? { handoff: o.handoff } : {}),
    ...(o.onBeforeMergeable ? { onBeforeMergeable: true } : {}),
    ...(o.browser ? { browser: true } : {}),
    ...(o.maxCost !== undefined ? { maxCost: o.maxCost } : {}),
  }
}


/**
 * Resolve the Claude Code driver options for a live session. A session is a headless autonomous
 * builder: every turn is `claude -p`, which cannot answer an interactive approval. The driver's
 * library default (`acceptEdits`) silently denies installs/builds/tests, so the production-grade
 * checklist can never verify the app actually builds/runs (#225). `bypassPermissions`, so the full
 * loop runs unattended.
 *
 * There used to be a `--permission-mode` and a `--dangerously-skip-permissions` to override it.
 * Neither had a dashboard control, so with the flags gone (D4) nothing sets them and the mode is
 * simply what it always resolved to.
 */
export function claudeDriverOptions(): ClaudeCodeDriverOptions {
  return { permissionMode: 'bypassPermissions' }
}

/**
 * The settings the picked agent cannot honor (#542), as lines to print at startup.
 *
 * A setting that silently does nothing is worse than one that errors. Codex with a spend cap
 * reads as capped and isn't: the cap is only ever checked on a turn that reports a price, and
 * Codex reports none (#540). The consumption limits go the same way — no quota to read means no
 * gate. So the session says which guards are not in force, rather than letting the setting imply
 * they are.
 */
export function unguardedNotices(opts: Pick<SessionOptions, 'agent' | 'maxCost' | 'browser'>): string[] {
  const spec = AGENT_SPECS[opts.agent]
  const notices: string[] = []
  if (opts.maxCost != null && !spec.reportsCost) {
    notices.push(`the $${opts.maxCost} spend cap cannot be enforced: ${spec.label} reports no price per turn, so it never fires (#540).`)
  }
  if (opts.agent !== 'claude' && opts.browser) {
    notices.push(`the browser has no effect on ${spec.label}: the browser tools are wired through Claude Code's MCP config.`)
  }
  return notices
}

/** The log kind a run records in `.the-framework/LOGS.md` (#379): the direct paths are prompts, a
 * build run is a build. Transparent (#625) routes a build-kind run through the raw prompt path too,
 * so it logs as a prompt. */
export function runLogKind(opts: Pick<SessionOptions, 'directPrompt' | 'research'>, transparent = false): LogEntry['kind'] {
  return opts.directPrompt || opts.research || transparent ? 'prompt' : 'build'
}

/**
 * Build the project-log entry (#379) for a finished run from its `end` event and
 * the session captured along the way. Pure, so the status mapping is unit-testable
 * without a live run.
 *
 * A run that never emitted `end` still gets an entry (#898) — it was stopped, or it died
 * mid-flight, and either way it happened and belongs in the committed log. `stopped` then
 * decides between the two, since there is no event left to ask.
 */
export function runLogEntry(input: {
  at: string
  kind: LogEntry['kind']
  title: string
  end?: Extract<FrameworkEvent, { kind: 'end' }> | undefined
  stopped?: boolean | undefined
  id?: string | undefined
  sessionId?: string | undefined
  sessionLink?: string | undefined
  sessionName?: string | undefined
  branch?: string | undefined
}): LogEntry {
  const status: LogEntry['status'] = input.end
    ? input.end.ok
      ? 'done'
      : input.end.stopped
        ? 'stopped'
        : 'failed'
    : input.stopped
      ? 'stopped'
      : 'failed'
  return {
    at: input.at,
    kind: input.kind,
    title: input.title,
    status,
    ...(input.id ? { id: input.id } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.sessionLink ? { sessionLink: input.sessionLink } : {}),
    ...(input.sessionName ? { sessionName: input.sessionName } : {}),
    ...(input.branch ? { branch: input.branch } : {}),
  }
}

/** This run's own flags as the nearest config layer (#841). A flag left off says nothing. */
function flagConfigLayer(opts: RunConfigFlags): ConfigLayer {
  return {
    name: 'flag',
    values: {
      ...(opts.preset !== undefined ? { preset: opts.preset } : {}),
      ...(opts.buildEvent !== undefined ? { event: opts.buildEvent } : {}),
      ...(opts.vanilla !== undefined ? { vanilla: opts.vanilla } : {}),
      ...(opts.transparent !== undefined ? { transparent: opts.transparent } : {}),
      ...(opts.handoff !== undefined ? { handoff: opts.handoff } : {}),
    },
  }
}

type RunConfigFlags = Pick<SessionOptions, 'preset' | 'buildEvent' | 'vanilla' | 'transparent' | 'handoff'>

/**
 * Resolve a run's config over its layers, nearest wins (#841): the run's flags, then the repo's
 * `the-framework.yml`. #800 slots the project-user and global tiers in between and at the end.
 */
export function mergeRunConfig(opts: RunConfigFlags, file: FrameworkFileConfig): ResolvedRunConfig {
  return resolveRunConfig([flagConfigLayer(opts), fileConfigLayer(file)])
}

/** The run-scoped state {@link settleRun} needs to close out either run path. */
interface RunEpilogue {
  io: CliIO
  store: RunStore | undefined
  control: ControlWatcher | undefined
  guard: { stop: () => void } | undefined
  /** The run's Chrome (#793), stopped with the run so no headless browser outlives it. */
  sharedBrowser: SharedBrowser | undefined
  /** The preview of that browser (#802), stopped with the run. */
  browserStream: BrowserStream | undefined
  clearInterrupt: () => void
  maybeFireOnBeforeMergeable: () => Promise<void>
  /** Hand the session's work back (#1102): push its branch and open a draft PR, if still armed. */
  maybeAutoHandoff: () => Promise<void>
  /** Write the run's `.the-framework/LOGS.md` entry (#898). Idempotent: called on every exit path. */
  finishLog: () => Promise<void>
  /** True once the run stopped cleanly (interrupt / budget cap) rather than failed. */
  isStopped: () => boolean
  /** How a real failure is labelled: "run", "research", or "prompt run". */
  failLabel: string
}

/**
 * Run one engine (a build or a direct prompt) and settle it identically: on success print its
 * line; on a clean stop (interrupt / budget cap #322) report it; on a real failure report it. The
 * teardown — flush the store, close the control channel + consumption guard — runs either way.
 * Returns the exit code (0 on success or a clean stop, 1 on a failure). Shared by both run paths
 * so their epilogues cannot drift.
 */
async function settleRun(ctx: RunEpilogue, run: () => Promise<{ successLine: string }>): Promise<number> {
  const { io } = ctx
  try {
    const { successLine } = await run()
    ctx.clearInterrupt()
    io.out(successLine)
    // Before the close, not after (#835): close() archives the log into `runs/`, so an
    // outcome appended afterwards would miss the copy the dashboard's history reads.
    await ctx.maybeFireOnBeforeMergeable()
    // After the quality step, so whatever it committed is in what gets pushed; before the close,
    // for the same reason as above — `close()` archives the log, and an outcome appended after it
    // would miss the copy the dashboard's history reads (#835).
    await ctx.maybeAutoHandoff()
    await ctx.finishLog()
    await ctx.store?.close() // flush the event log; best-effort
    return 0
  } catch (err) {
    ctx.clearInterrupt()
    // Before the close, like the success path: a run that stopped or blew up is still a session,
    // and this is the only place the failing path can record it (#898).
    await ctx.finishLog()
    await ctx.store?.close()
    // A clean stop (Stop button, Ctrl+C, or a budget cap #322) is not a failure: report it and
    // exit 0. The dashboard that spawned this session shows the stopped state from its event log.
    if (ctx.isStopped()) {
      io.out('\n■ Stopped.')
      return 0
    }
    io.err(`\n✗ ${ctx.failLabel} failed: ${errorMessage(err)}`)
    return 1
  } finally {
    ctx.clearInterrupt()
    ctx.control?.close()
    ctx.guard?.stop()
    await ctx.browserStream?.close()
    await ctx.sharedBrowser?.close()
  }
}

/**
 * Resolve the system-prompt configuration both run paths share (#301/#314), echoing what
 * is in effect: a user SYSTEM.md, the built-in prompt toggle, and the in-context dirs. Reads
 * SYSTEM.md once, so call it on the shared path before the session starts.
 */
async function resolvePromptConfig(
  opts: SessionOptions,
  config: ResolvedRunConfig,
  cwd: string,
  io: CliIO,
  transparent: boolean,
): Promise<{ userSystemPrompt?: string; noBuiltinPrompt: boolean }> {
  const userSystemPrompt = await loadUserSystemPrompt(cwd)
  // Transparent empties the whole channel, which subsumes "no built-in prompt".
  const noBuiltinPrompt = transparent || config.vanilla
  if (userSystemPrompt) io.out(`◆ system prompt: ${SYSTEM_PROMPT_FILE}`)
  // Transparent already announced itself (guard line); don't double-report the prompt being off.
  // Name the layer that turned it off.
  const offBy = config.sources.vanilla ?? 'transparent'
  if (noBuiltinPrompt && !transparent) io.out(`◆ built-in system prompt: off (${offBy})`)
  if (opts.context.length) io.out(`◆ context: ${opts.context.join(', ')}`)
  return { ...(userSystemPrompt ? { userSystemPrompt } : {}), noBuiltinPrompt }
}

/**
 * The `framework` command. Wires the parsed options into {@link runFramework}
 * over a live dashboard + terminal narration, and resolves with an exit code.
 * Returns 0 on success, 1 on a run error, 2 on a usage error.
 */
/**
 * Whether this run can be steered over `.the-framework/control.jsonl` (#344): Stop, a choice pick,
 * a live message. True when its own dashboard is up (#427), or when whoever spawned it handed it a
 * run id — the dashboard spawns each session with one in its spec, and steers it
 * from its own process.
 *
 * This used to have a third clause, "a daemon is alive somewhere on this machine", read from a
 * global state file. That file is gone with the background daemon (D4b), and it was never a fact
 * about *this* run in the first place: it went missing while the daemon was very much alive
 * (#922), and every Stop press then landed in control.jsonl and was read by nobody, in silence
 * (#905). A run id holds when a file about another process does not.
 */
export function isSteerable(opts: { persist: boolean; runId?: string | undefined }): boolean {
  return opts.persist && opts.runId !== undefined
}

/**
 * Whether this session should stay open for the user's own messages once it settles (#714).
 *
 * The other half of #905. Being steerable only means someone *could* reach it; staying open means
 * a human is expected to keep talking to it. A headless run is neither, but it used to inherit the
 * chat queue purely because a daemon happened to be alive elsewhere on the machine, and then
 * parked forever on a message nothing could send. #714 said as much: "headless / CI runs end when
 * done, exactly as today."
 *
 * So: the dashboard started it (a run id) and therefore has a UI to carry on the conversation in.
 * Stop and gate picks keep working either way.
 */
export function isInteractive(opts: { runId?: string | undefined }): boolean {
  return opts.runId !== undefined
}

/**
 * Route Ctrl+C / SIGTERM into aborting the run — not into default signal termination, which
 * would kill the framework while its spawned Claude Code tree keeps running (the
 * orphaned-process leak). Aborting drives the driver to group-kill its child; a second
 * signal force-quits. Returns the disarm, called once the run settles.
 */
function armInterrupt(controller: AbortController, io: CliIO): () => void {
  let interrupts = 0
  const onInterrupt = () => {
    if (++interrupts === 1) {
      io.err('\n■ Interrupt: stopping the session (Ctrl+C again to force-quit)…')
      controller.abort()
    } else {
      process.exit(130)
    }
  }
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onInterrupt)
  return () => {
    process.off('SIGINT', onInterrupt)
    process.off('SIGTERM', onInterrupt)
  }
}

/**
 * Record chat turns into the committed conversation (#908). Fire-and-forget at the call
 * site — a failed write must never stall or fail a run — but appends are chained rather
 * than fired in parallel: each one creates the dir/header before it writes, so two
 * overlapping turns would race and could land the reply above the message it answers.
 * `flush()` is awaited before the run's log entry, or the last reply is lost (#908).
 */
function conversationRecorder(deps: {
  cwd: string
  enabled: boolean
  conversationId: string | undefined
  localVia: string
}): { recordMessage?: RecordMessage; flush: () => Promise<void> } {
  const { cwd, conversationId } = deps
  if (!deps.enabled || !conversationId) return { flush: () => Promise.resolve() }
  let tail: Promise<void> = Promise.resolve()
  const recordMessage: RecordMessage = (role, text, via) => {
    // A per-turn origin wins, but only a safe one: it arrives from a chat surface over the
    // control channel, and the heading it lands in is line-parsed (#897's threat model).
    const message = { at: new Date().toISOString(), role, via: isSafeVia(via) ? via : deps.localVia, text }
    tail = tail.then(() => appendMessage(cwd, conversationId, message)).catch(() => {})
  }
  return { recordMessage, flush: () => tail }
}

/** What the run journal exposes to the epilogue. See {@link createRunJournal}. */
export interface RunJournal {
  onEvent: (event: FrameworkEvent) => void
  /** The session name the agent chose via setSessionName() (#326), once it has. */
  sessionName: () => string | undefined
  /** The agent signalled setReadyForMerge() this run (#326). */
  sawReadyForMerge: () => boolean
  /** The run stopped cleanly (user interrupt / budget cap #322) rather than failed. */
  stoppedCleanly: () => boolean
  /** Hold the browser preview's port until the session opens (#829/#813). */
  announceBrowserPort: (port: number) => void
  /** The page the browser preview is on (#1455 item 6b): emitted as a `browser` event once a
   *  session is open, held until then, and re-said after every later `session` so the row
   *  survives the dashboard's last-session slice. */
  announceBrowserUrl: (url: string) => void
  /** Write the run's `.the-framework/LOGS.md` entry (#898). Idempotent; every exit path calls it. */
  finishLog: () => Promise<void>
}

/**
 * The run's event sink and the state its epilogue reads. One event arrives and this prints it,
 * persists it, folds the fields the LOGS.md entry needs (session
 * id/link, the end event), tracks the settle flags (#322/#326), renames the framework-owned
 * branch once the agent names its session (#736), and re-emits a held browser-stream port
 * right after `session` so it lands in the slice the dashboard renders (#829). These jobs sat
 * inline in runCli across six mutable locals; the journal is their one owner, and runCli reads
 * the getters. Exported for the rename-records-the-branch test (#1277).
 */
export function createRunJournal(deps: {
  io: CliIO
  cwd: string
  store: RunStore | undefined
  runId: string | undefined
  kind: LogEntry['kind']
  title: string
  /** Awaited before the log entry is written: the queued conversation appends (#908). */
  beforeLog: () => Promise<void>
}): RunJournal {
  const { io, cwd, store } = deps
  // The framework's own verdict that the run stopped cleanly rather than failed — set by a
  // user interrupt or a budget cap (#322). Trusted over which signal aborted, since a budget
  // stop trips an internal signal the CLI never sees.
  let stoppedCleanly = false
  let sawReadyForMerge = false
  let sessionName: string | undefined
  let logSessionId: string | undefined
  let logSessionLink: string | undefined
  let logEnd: Extract<FrameworkEvent, { kind: 'end' }> | undefined
  // The browser preview's port, announced on the first `session` event rather than when the
  // bridge opens (#829): the dashboard renders only the tail from the last `session` event, so
  // anything emitted ahead of it is dropped from the run's view.
  let pendingBrowserPort: number | undefined
  // The page the browser preview is on (#1455 item 6b). Held the same way the port is until a
  // session opens; after that a navigation emits straight away. Re-emitted after EVERY `session`
  // (not just the first, unlike the port whose meta fold survives the slice): a continuation
  // starts a fresh rendered slice, and without the re-say its transcript would have no browser
  // row to host the pane.
  let latestBrowserUrl: string | undefined
  let sessionOpen = false

  const onEvent = (event: FrameworkEvent) => {
    if (event.kind === 'session' && event.sessionLink) logSessionLink = event.sessionLink
    else if (event.kind === 'session-update') {
      logSessionId = event.sessionId
      if (event.sessionLink) logSessionLink = event.sessionLink
    }
    if (event.kind === 'ready-for-merge') sawReadyForMerge = true
    if (event.kind === 'session-name') {
      sessionName = event.name
      // The framework-owned checkout (#736) was branched as `the-framework/run-<id>` before a
      // name existed; put the readable name on it now. No-ops when the agent branched itself,
      // and only a rename that happened is recorded (#1277) — a guessed name on the meta is
      // exactly what the branch event exists to end.
      if (deps.runId) {
        const renamed = `the-framework/${event.name}`
        void renameRunBranch(cwd, runBranchName(deps.runId), renamed).then(didRename => {
          if (didRename) onEvent({ kind: 'branch', branch: renamed })
        })
      }
    }
    if (event.kind === 'end') {
      if (event.stopped) stoppedCleanly = true
      // Held, not logged here (#898): the entry is written as the run settles, which is both
      // after every run reaches it (an `end` is not guaranteed) and the last moment the branch
      // can still be read off the checkout.
      logEnd = event
    }
    io.out(formatFrameworkEvent(event))
    void store?.append(event)

    // Right after the session opens, so it lands inside the slice the dashboard renders.
    if (event.kind === 'session') {
      sessionOpen = true
      if (pendingBrowserPort !== undefined) {
        const port = pendingBrowserPort
        pendingBrowserPort = undefined
        onEvent({ kind: 'browser-stream', port })
      }
      if (latestBrowserUrl !== undefined) onEvent({ kind: 'browser', url: latestBrowserUrl })
    }
  }

  // Once per run, and on every path out — a stopped or crashed run is still a session that
  // happened, and leaving it out is what made the committed log an incomplete record (#898).
  let logged = false
  const finishLog = async (): Promise<void> => {
    if (logged) return
    logged = true
    // Let the queued conversation appends land before we exit, or the last reply is lost (#908).
    await deps.beforeLog()
    const entry = runLogEntry({
      at: new Date().toISOString(),
      kind: deps.kind,
      title: deps.title,
      end: logEnd,
      stopped: stoppedCleanly,
      id: deps.runId,
      sessionId: logSessionId,
      sessionLink: logSessionLink,
      sessionName,
      // The last moment it can be observed (#799): a run worktree is torn down after this
      // process exits, and the agent may have branched itself, so neither name is derivable later.
      branch: await currentBranch(cwd),
    })
    await appendLog(cwd, entry).catch(() => {})
  }

  return {
    onEvent,
    sessionName: () => sessionName,
    sawReadyForMerge: () => sawReadyForMerge,
    stoppedCleanly: () => stoppedCleanly,
    announceBrowserPort: port => {
      pendingBrowserPort = port
    },
    announceBrowserUrl: url => {
      latestBrowserUrl = url
      if (sessionOpen) onEvent({ kind: 'browser', url })
    },
    finishLog,
  }
}

export async function runCli(argv: string[], io: CliIO = defaultIO): Promise<number> {
  const args = parseArgs(argv)
  if (args.error) {
    io.err(args.error)
    io.err('Run `framework --help` for usage.')
    return 2
  }
  if (args.help) {
    io.out(HELP)
    return 0
  }
  if (args.version) {
    io.out(frameworkVersion())
    return 0
  }
  // `--session <path>`: the dashboard's process API (D4). One session, described entirely by the
  // JSON spec at that path — which is consumed as it is read, so a device token in its options
  // does not outlive the session that used it.
  if (args.session !== undefined) {
    let spec: SessionSpec
    try {
      spec = await readSessionSpec(args.session)
    } catch (err) {
      io.err(`could not read the session spec (${errorMessage(err)}).`)
      return 2
    }
    return driveSession(sessionOptions(spec), io)
  }
  // Everything else is bare `framework`: serve the dashboard in the foreground until Ctrl-C.
  return runForegroundDaemonCmd(args, io)
}

/**
 * Everything the CLI wires around one session before {@link runSession} drives it: config
 * resolved over the layers, the store, the control channel, the browser, the consumption guard
 * and the journal — then handed to {@link settleRun}. Returns the process exit code. Split out of
 * {@link runCli} so the top reads as a dispatch table and this reads as one session's lifecycle.
 */
async function driveSession(opts: SessionOptions, io: CliIO): Promise<number> {
  const fake = opts.fake
  const intent = opts.intent || (fake ? FAKE_INTENT : '')
  // A `prompt` session runs verbatim text, so it needs some. `research` is the one kind whose
  // empty prompt is fine — its "what" falls back to the preset default.
  if (!intent && !fake && !opts.research) {
    io.err('this session has no prompt to run.')
    return 2
  }

  const cwd = opts.cwd ?? (fake ? join(tmpdir(), 'framework-fake-workspace') : process.cwd())

  // The project can carry its own Open Loop defaults in the-framework.yml (#258):
  // which domain preset + modes to build under. CLI flags override the file; a bad
  // file is a warning, never a failed run. Read from the run's own workspace, so a
  // The fake demo (empty tmp cwd) stays deterministic unless pointed at a config dir.
  const fileConfig = await loadFrameworkConfig(cwd, msg => io.err(msg))
  // One resolve over the layers (#841): the nearest layer that set a key wins, so this run's
  // flags beat the repo file and an explicit `--no-autopilot` can turn off what the file set.
  const config = mergeRunConfig(opts, fileConfig)
  const fromConfig = describeResolvedConfig(config)
  if (fromConfig) io.out(`◆ config: ${fromConfig}`)

  // Transparent mode (#625): the coarse master off-switch — `--transparent` or the-framework.yml.
  // When on, this run is byte-identical to raw `claude -p`: no framework system channel (composed
  // empty below), no consumption guard, no dashboard, no TODO loop. Resolved once here so every
  // one of those sites reads the same answer.
  const transparent = config.transparent

  // Only the direct-prompt path resumes a conversation (#782): a build run rebuilds the
  // scope/build framing a resumed transcript already carries, so it takes no session id and
  // used to drop the flag on the floor. Silently losing the context you asked to continue
  // from is the worst outcome, so say so and stop rather than run a fresh session that looks
  // like a resumed one. The exception is a continuation (#1467): `--continue-run` re-enters an
  // existing run, whose recorded flow decides the path — there the session id is the point.
  if (opts.resumeSession && !(opts.research || opts.directPrompt || transparent || opts.continueRun)) {
    io.err('a resumed agent session only applies to a prompt session, not a build.')
    io.err('Run `framework --help` for usage.')
    return 2
  }

  // No preflight here. The dashboard already ran it before spawning this session (#1326,
  // `daemon-runtime`'s `agentPreflight`) and refused the start outright if the picked agent could
  // not run, so a doomed session spends no branch and no worktree — and the report lands on the
  // surface the user is looking at, rather than in a log they have to go and find. Re-running it
  // here was the same check a second time, and it was wrong for a session that runs somewhere else
  // entirely: `--run-on actions` needs no local agent CLI at all, which is exactly why the
  // dashboard's own check skips it.

  // Which agent is about to spend the user's subscription, and which guards are
  // not in force while it does — said *before* the first turn. A cap that turns
  // out not to apply is worth knowing before the spending, not after (#542).
  if (!fake) {
    if (opts.agent !== 'claude') io.out(`◆ agent: ${AGENT_SPECS[opts.agent].label}`)
    for (const note of unguardedNotices(opts)) io.err(`note: ${note}`)
  }

  const claudeOpts = claudeDriverOptions()
  // Computed once here, reused by extension discovery and the run.
  // One controller for the whole run: the dashboard Stop button aborts it once
  // wired below.
  const controller = new AbortController()

  // Ctrl+C / SIGTERM during a live run aborts the run; disarmed once it settles so the
  // post-run dashboard wait keeps its own Ctrl+C handling.
  const clearInterrupt = armInterrupt(controller, io)

  // The dashboard Stop button aborts the run-wide controller created above.
  // runFramework checks the signal between phases and the driver kills its current
  // turn on it, so a stop takes effect promptly.
  //
  // Interactive choices (#304): the run's requestChoice handler parks a resolver
  // here keyed by the choice id; the dashboard's Accept / autopilot POSTs the pick
  // to /choice, which resolves it. Aborting the run resolves any pending choice
  // (proceed) so the gate never hangs a stopped run.
  const pendingChoices = new Map<string, (pick: ChoicePick) => void>()
  // Live-chat messages the user sends to the running run (#714). The control watcher
  // pushes each here; the run loop drains them between turns and waits here when idle.
  const messages = new RunMessageQueue()
  controller.signal.addEventListener('abort', () => {
    for (const resolve of pendingChoices.values()) resolve({ picked: 'proceed', by: 'auto' })
    pendingChoices.clear()
    messages.close()
  })
  // No per-session dashboard (D3). The one that spawned this session is already serving the UI,
  // reading this session's event log off disk and steering it through control.jsonl — the file is
  // the seam, so a second server on a second port was only ever a second implementation of the
  // product's front door.

  // Persist the orchestration state so a restart can --resume it (#211). The log
  // is the dashboard's own event stream, appended to .the-framework/ in the workspace.
  // Best-effort: a store that fails to open just means no persistence, never a
  // failed run. --no-persist opts out entirely.
  let store: RunStore | undefined
  if (opts.persist) {
    try {
      // Seed the run's intent (its prompt) so the dashboard's Runs list labels it instead of
      // showing "(no prompt)". A build run refines this via its scope event; a prompt/research
      // run keeps it. Research with no "what" uses the same preset default the log title uses.
      store = await RunStore.open(cwd, {
        fresh: true,
        intent: intent || (opts.research ? defaultWhat() : ''),
        // Adopt the daemon's id (#736) so the run and the worktree it lives in share one.
        ...(opts.runId ? { id: opts.runId } : {}),
        // Continuing (#762): keep the existing log rather than starting this run's history over.
        ...(opts.continueRun ? { continueRun: true } : {}),
        // The flow this run starts under (#1467), so a later continuation can re-enter it. A
        // continuation itself keeps the prior meta's record — this seed only lands on a fresh run.
        kind: runLogKind(opts, transparent) === 'build' ? 'build' : 'prompt',
        // Where the run executes (#1053): the run view reads it to switch to the Actions affordance.
        ...(opts.target ? { target: opts.target } : {}),
        // A project-less topic run (#1120): recorded so a reader can tell it from a project run.
        ...(opts.topic ? { topic: true } : {}),
      })
    } catch (err) {
      io.err(`could not persist session state (${errorMessage(err)}); continuing without it`)
    }
  }

  // Continuing a build run (#1467): the composer's Resume always arrives as a `prompt` start,
  // but the reopened meta remembers the flow the first leg ran. When it was a build run and the
  // conversation is resumable, re-enter the build flow (synthesize framing, backlog loop, the
  // build ending) with the message sent verbatim — not the bare prompt ending that used to
  // downgrade a resumed build run. Runs from before the meta recorded a kind stay on the prompt
  // path, exactly as they did.
  const continueBuild =
    opts.continueRun === true && !!opts.resumeSession && !transparent && store?.snapshot().kind === 'build'

  // Steer this run through .the-framework/control.jsonl (#344): a Stop button or choice
  // pick appends an entry, we tail the file and abort / resolve the parked gate. Reset
  // first so a previous run's picks can never fire into this one (gate ids repeat across
  // runs).
  //
  // Wired when this run's own dashboard is up (#427), or when whoever spawned it passed --run-id
  // and therefore steers it (see {@link isSteerable}).
  // What this session hands back when it ends (#1102). Mutable: the action bar's checkboxes can
  // move it at any point up to the moment it settles, which is the whole point of them being
  // pre-commitments rather than buttons. One rung, not three flags (B5), so the stages cannot
  // disagree — every reader derives them, and a box unticked mid-run lowers the whole ladder
  // instead of leaving a merge armed with no PR under it.
  // The one thing that raises it after this line is the user's own Merge action (#1391), which
  // also records the human authorization below.
  let armedHandoff: HandoffLevel = config.handoff
  // The user pressed Merge (#1391): a human authorized the merge, so the #1363 gate must not also
  // demand the agent's ready-for-merge signal — a human's word outranks it.
  let mergeAuthorized = false
  // Assigned once the journal exists, which is after the control watcher is wired: a change that
  // arrives before then still lands on `armedHandoff`, it just has no event to announce it yet.
  let announceHandoff: (() => void) | undefined
  // Same deferral as announceHandoff: an await-bind-project / await-create-project gate binds this
  // topic run to a project (#1121), and only an event puts that on the meta a later-opened tab can
  // read. Wired once the journal exists (below).
  let recordBind: ((projectId: string) => void) | undefined

  let control: ControlWatcher | undefined
  if (isSteerable(opts)) {
    try {
      await resetControl(cwd)
      control = watchControl(cwd, entry => {
        if (entry.kind === 'stop') {
          controller.abort()
          return
        }
        if (entry.kind === 'message') {
          // Carry the origin the sender named (#917), so the turn is recorded where it happened.
          messages.push(entry.text, entry.via)
          return
        }
        if (entry.kind === 'handoff') {
          armedHandoff = entry.level
          announceHandoff?.()
          return
        }
        if (entry.kind === 'bind') {
          // Fold the bind onto meta + the event log; the daemon watches for it and re-homes (#1122).
          recordBind?.(entry.projectId)
          return
        }
        if (entry.kind === 'merge') {
          // The user's Merge action (#1391): arm the full ladder and record the human
          // authorization. Not an abort — the session still ends at its own natural end (#1390)
          // and the merge fires there; announcing re-arms keeps the meta a mid-run tab reads true.
          armedHandoff = 'merge'
          mergeAuthorized = true
          announceHandoff?.()
          // A session parked on the backlog offer (#323) is waiting to know whether to take more
          // work. Merge answers that: wrap up now. Other gates keep waiting — they are questions
          // about the work itself, which merging does not answer.
          for (const [id, resolve] of pendingChoices) {
            if (!/^todo-next(-\d+)?$/.test(id)) continue
            pendingChoices.delete(id)
            resolve({ picked: 'stop', by: 'user' })
          }
          return
        }
        const resolve = pendingChoices.get(entry.id)
        if (resolve) {
          pendingChoices.delete(entry.id)
          resolve({ picked: entry.pick, by: entry.by })
        }
      })
    } catch (err) {
      io.err(`control channel unavailable (${errorMessage(err)}); daemon steering disabled`)
    }
  }

  // Pause the choice gates when someone can answer: this run's own dashboard, or the
  // workspace daemon's via the control channel (#344). With neither, the gates auto-accept
  // the recommended option (#304). The run's requestChoice parks a resolver in pendingChoices
  // keyed by the choice id; a dashboard/daemon pick (or an abort) resolves it.
  // An unattended run (#846) is steerable but unwatched: keep the control channel for Stop and
  // live messages, and leave requestChoice unset so each gate takes its recommended option. Auto
  // PM (#685) fires when nobody is there, and a parked gate would hang it until someone looked.
  //
  // Each parked wait is held by the keepalive (#1359): a daemon-spawned run (--no-dashboard, all
  // stdio detached, per-prompt driver children, unref'd control watcher) has nothing else ref'd
  // between turns, so Node ran out of scheduled work and exited 0 mid-await — the gate's picks
  // then landed in control.jsonl with nobody left to read them.
  const gateKeepalive = createGateKeepalive()
  const requestChoice =
    control !== undefined && !opts.unattended
      ? (req: ChoiceRequest): Promise<ChoicePick> =>
          gateKeepalive.hold(new Promise(resolve => pendingChoices.set(req.id, resolve)))
      : undefined

  // Whether to hand the run the live-chat queue (#714) once it settles. Steerable is not enough
  // (#905): a terminal run with --no-dashboard could be reached by a daemon's dashboard, but
  // nobody is waiting in it, and it used to park forever on a message that never came.
  // The parked message wait is the same empty-event-loop hazard as a parked gate (#1359), so it
  // is held the same way; a Stop closes the queue, which releases the hold.
  //
  // Who parks and who ends is #1390: a dashboard-spawned session drains what queued and then ends
  // itself — the dashboard reopens the conversation as a continuation (#762), so nothing needs to
  // stay alive for the composer.
  const chatQueue =
    isInteractive(opts) && requestChoice
      ? {
          messages: {
            next: (signal?: AbortSignal) => gateKeepalive.hold(messages.next(signal)),
            takeQueued: () => messages.takeQueued(),
          },
          ...(opts.runId === undefined ? { stayOpenChat: true } : {}),
        }
      : {}

  // Persist the chat into the committed conversation (#908/#857), so a clone carries what was
  // said and not just the fact a run happened. Keyed by the same run id LOGS.md records, which
  // is what joins the committed session list to the committed chat. `--via` names the surface
  // for a run the daemon started on another surface's behalf (#917); otherwise it is whichever
  // local surface is here.
  const conversation = conversationRecorder({
    cwd,
    enabled: opts.persist,
    conversationId: opts.runId ?? store?.snapshot().id,
    localVia: isSafeVia(opts.via) ? opts.via : requestChoice ? 'dashboard' : 'cli',
  })
  const recordMessage = conversation.recordMessage

  // The session link shown on the dashboard: --session-link, else Claude Code's own entry for
  // a live Claude run, else nothing (#212/#542). Same for both run paths.
  const sessionLink = chooseSessionLink(opts, fake)

  // Everything the run reports that its epilogue needs — the settle flags, the LOGS.md
  // fields, the deferred browser-port announcement — plus the fan-out of every event to the
  // terminal, the store and the relay, lives in the journal. runCli reads its getters below.
  const journal = createRunJournal({
    io,
    cwd,
    store,
    runId: opts.runId,
    // A build continuation (#1467) logs as the build run it re-enters, not as the prompt
    // start that carried it here.
    kind: continueBuild ? 'build' : runLogKind(opts, transparent),
    title: intent || (opts.research ? defaultWhat() : ''),
    beforeLog: conversation.flush,
  })
  const onEvent = journal.onEvent

  // Put the armed state on the run's meta (#1102), and keep it there as the checkboxes change it.
  // The control channel carries the instruction, but only an event reaches meta, and meta is the
  // only thing a dashboard tab opened mid-run can read the boxes back from.
  // The event still spells the three stages out (#1382): it is a snapshot a dashboard tab reads
  // back, and every armed line must carry the merge stage or the meta would say "draft PR" about a
  // run that is set to merge. Derived from the rung, so the three can never contradict it.
  announceHandoff = () => onEvent({ kind: 'handoff-armed', ...handoffStages(armedHandoff) })
  announceHandoff()
  // The ticket this run implements (#1117), if the daemon named one. Once, at start: it is a fact
  // about why the run exists, not a state that changes, and folding it to meta is what lets the
  // Overview mark that ticket as being implemented right now.
  if (opts.ticket && isTicketPath(opts.ticket)) onEvent({ kind: 'ticket', path: opts.ticket })
  // The queue entry a routine drain pinned this run to (#1253), same shape as the ticket above:
  // once, at start, folded to meta — the durable half of the sweep's claim on the entry.
  if (opts.queueEntry?.trim()) onEvent({ kind: 'queue-entry', entry: opts.queueEntry })
  // The branch this run actually starts on (#1277): recorded, not guessed, so surfaces reading
  // the meta mid-run resolve the same name teardown will later confirm. Undefined outside a git
  // checkout (a non-repo project), and then nothing is recorded.
  const startBranch = await currentBranch(cwd)
  if (startBranch) onEvent({ kind: 'branch', branch: startBranch })
  // Wired now the journal exists: a bind resolved from a topic run's gate folds to meta (#1121).
  recordBind = projectId => onEvent({ kind: 'bind', projectId })

  // Fire the #326 on-before-mergeable prompt once a --on-before-mergeable run has settled and the agent
  // signalled setReadyForMerge(). Skipped for a fake/offline run and when the run was stopped —
  // and every outcome, including each skip, is emitted as an event so the dashboard can show it (#835).
  const maybeFireOnBeforeMergeable = async (): Promise<void> => {
    // The step was never asked for, so there is no outcome to report and nothing to explain.
    if (!opts.onBeforeMergeable) return
    // Every other exit says so as an event (#835). stdout cannot carry this: a dashboard-started
    // run is spawned with `stdio: 'ignore'`, so silence there read as "it ran and found nothing".
    const skip = (reason: OnBeforeMergeableSkip) =>
      onEvent({ kind: 'on-before-mergeable', outcome: 'skipped', reason })
    if (!journal.sawReadyForMerge()) return skip('not-ready-for-merge')
    if (journal.stoppedCleanly()) return skip('run-stopped')
    if (fake) return skip('fake-run')
    // --eco-auto-maintenance (#314) no longer skips the whole run: since #537 this prompt
    // also carries `## Business knowledge`, which the flag does not name. It drops just
    // `## Maintenance` inside renderOnBeforeMergeablePrompt() instead.
    // Every line of the prompt names the session, so there is nothing to queue without one.
    // An agent that made changes has one; this is the agent that ignored the instruction.
    const sessionName = journal.sessionName()
    if (!sessionName) return skip('no-session-name')
    const binPath = process.argv[1]
    if (!binPath) return skip('no-bin-path')
    const outcome = await runOnBeforeMergeable(
      cwd,
      binPath,
      io,
      { session_name: sessionName },
      opts.maxCost,
    )
    onEvent({ kind: 'on-before-mergeable', outcome })
  }

  // Hand the session's work back (#1102): push the branch and open a draft PR for it, unless the
  // action bar's checkboxes were unticked. Runs after the on-before-mergeable step above, so
  // anything that step committed is part of what gets published rather than a commit left behind.
  const maybeAutoHandoff = async (): Promise<void> => {
    const armed = handoffStages(armedHandoff)
    const skip = (reason: AutoHandoffSkip) => onEvent({ kind: 'handoff', outcome: 'skipped', reason })
    if (!armed.push) return skip('not-armed')
    // A stopped run is a session the user cut short; publishing what it happened to reach is the
    // opposite of what stopping meant. Same call the on-before-mergeable step makes.
    if (journal.stoppedCleanly()) return skip('run-stopped')
    if (fake) return skip('fake-run')
    // A topic run (#1120) lives in a project-less scratch dir: no repo, no branch, nothing to
    // publish. Without this, the commit attempt below burns its retries against a non-repo and
    // labels the end `commit-failed` — alarming copy about work that never existed. It never
    // had a branch, which is what branch-gone says.
    if (opts.topic) return skip('branch-gone')

    // The daemon commits whatever the agent left uncommitted, but only after this process exits
    // (`tearDownWorktree`), so at this point the tree can still hold real work. Pushing first
    // would publish a branch missing the session's last edits. Its own checkout only: a plain
    // `framework "..."` runs in the user's tree, where committing for them is not ours to do.
    //
    // The result is load-bearing (#1376): a commit that failed here and was ignored let the
    // handoff judge a branch missing the session's work — "committed nothing", skip — while the
    // teardown's identical commit landed seconds later, stranding real work on a local branch
    // nobody was told about. A failed commit is now its own skip, said out loud, and the
    // teardown still rescues the work onto the branch afterwards.
    if (opts.runId && !(await commitPendingWork(cwd))) return skip('commit-failed')

    // The merge half is authorized, not just configured (#1363; rule settled on #1390): the
    // agent's setReadyForMerge() — the same signal maybeFireOnBeforeMergeable requires above —
    // is what says the work may land unattended, plus the session's own TODO file having no
    // open entries. Never the global TODO_AGENTS.md: the queue is decoupled from sessions.
    // Withheld is not skipped — push and PR go ahead, and with `armed.merge` off the PR opens
    // as a draft for a human. Said on the handoff event (#835), or "auto-merge was on and
    // nothing merged" has no answer.
    // A human's Merge action (#1391) bypasses the gate: the authorization the gate exists to
    // collect has been given directly, by someone who outranks the signal.
    let mergeGate: MergeWithheldReason | undefined
    if (armed.merge && !mergeAuthorized) {
      const ready = journal.sawReadyForMerge()
      mergeGate = withheldMerge({
        readyForMerge: ready,
        sessionTodoOpen: ready && (await sessionTodoPending(cwd, journal.sessionName())),
      })
      if (mergeGate) armed.merge = false
    }

    // The branch as it is now, not as it was named at start: #326 lets the agent rename it, and
    // the rename is exactly what the PR should be opened against.
    const branch = await currentBranch(cwd)
    if (!branch) return skip('branch-gone')
    const sessionName = journal.sessionName()
    // The ticket's GitHub issue rides the PR title as `(fix #42)` (#1334): the squash-merge
    // subject inherits the title, so the merge closes the issue — without it, an auto-merged
    // quick-win leaves its ticket open. Not on a plan run (#1327): its PR lands the plan, not
    // the work, so the merge must not close the issue. Best-effort: a ticket that cannot be
    // read fixes nothing.
    const fixes = opts.ticket && isTicketPath(opts.ticket) && !opts.planRun
      ? ticketIssueRef(await readFile(join(cwd, opts.ticket), 'utf8').catch(() => ''))
      : undefined
    const run = {
      id: opts.runId ?? '',
      branch,
      ...(sessionName ? { sessionName } : {}),
      ...(intent ? { intent } : {}),
      ...(fixes ? { fixes } : {}),
    }
    const handedOff = await runAutoHandoff(cwd, run, armed)
    const outcome =
      mergeGate && handedOff.outcome !== 'failed'
        ? { ...handedOff, merge: { outcome: 'withheld' as const, reason: mergeGate } }
        : handedOff
    onEvent({ kind: 'handoff', ...outcome })
    if (outcome.outcome === 'failed') io.err(`✗ could not ${outcome.step === 'pr' ? 'open the PR' : 'push the branch'}: ${outcome.error}`)
    else if (outcome.outcome === 'done' && outcome.url) io.out(`\n◆ Opened ${outcome.url}`)
    else if (outcome.outcome === 'done') io.out(`\n◆ Pushed ${branch}.`)
    // The merge half (#1216) rides on the outcome rather than being its own step: a merge that
    // could not happen must not read as a failed handoff, the PR is there either way.
    const merge = outcome.outcome !== 'failed' ? outcome.merge : undefined
    if (merge?.outcome === 'auto-armed') io.out('◆ Auto-merge armed: the PR lands when its checks pass.')
    else if (merge?.outcome === 'watched') io.out('◆ Merge on green: the daemon merges the PR when its checks pass.')
    else if (merge?.outcome === 'merged') io.out('◆ Merged the PR.')
    else if (merge?.outcome === 'withheld') io.out(`◆ Merge withheld: ${mergeWithheldWhy(merge.reason)}.`)
    else if (merge?.outcome === 'failed') io.err(`✗ could not merge the PR: ${merge.error}`)
  }

  // The run owns the browser (#793): launching it here, rather than letting chrome-devtools-mcp
  // launch its own, is what lets the #609 preview attach to the same page. Undefined when the
  // machine has no Chrome, which leaves `--browser` on its old path rather than failing the run.
  // Local runs only: the browser tools are wired on this machine, so a `--run-on web`/`actions`
  // session could never reach them — launching Chrome here would leak a headless browser per
  // run, and the system channel must only claim a browser the run really has (#824).
  const localRun = opts.target === undefined || opts.target === 'local'
  const sharedBrowser = opts.browser && !fake && localRun ? await launchSharedBrowser() : undefined
  if (opts.browser && !fake && !localRun) {
    io.err(`note: --browser has no effect with --run-on ${opts.target}: the browser tools are wired on this machine, and the session runs elsewhere.`)
  } else if (opts.browser && !fake && !sharedBrowser) {
    io.err('note: no Chrome found, so --browser falls back to its own browser (no preview).')
  }

  /**
   * Give up before a driver exists, on a config fault the run cannot recover from.
   *
   * These aborts sit in an awkward window: `run.json` already says `running` (it is written back
   * at :1433), but {@link settleRun} — which owns the `end` event and the handle cleanup — does
   * not wrap anything until its `ctx` is built further down. Returning raw therefore left the run
   * recorded as `running` forever with nobody to correct it, and the dashboard showed a session
   * that never moved. So close it out here the same way settleRun would: say why, record the
   * failure, release the handles.
   *
   * Best-effort throughout, like every other persistence call on this path: a store that cannot
   * write its own failure must still let the process exit, which is the whole point of the fix.
   */
  const abortBeforeDriver = async (reason: string): Promise<number> => {
    io.err(reason)
    // Release every handle settleRun would: the armed interrupt trap, the run's own dashboard
    // server, and the LOGS.md entry — leaving any of them behind kept the process alive with a
    // swallowed first Ctrl+C, exactly the hang this helper exists to prevent.
    clearInterrupt()
    try {
      await store?.append({ kind: 'end', ok: false, detail: reason })
      await store?.close()
    } catch {
      // Persistence is never allowed to be the thing that keeps a failing run alive.
    }
    await journal.finishLog().catch(() => {})
    control?.close()
    await sharedBrowser?.close().catch(() => {})
    return 2
  }

  // Run on GitHub Actions (#1050): owner/repo come from the project's origin remote, the token from
  // the environment or, failing that, the `gh` CLI (#1352) — never the committed the-framework.yml,
  // since a repo file is public and this must be a user credential. Resolved before the driver so a
  // missing remote or token fails the run with a clear reason rather than deep inside ActionsDriver.
  let actionsConfig: ActionsDriverOptions | undefined
  if (opts.target === 'actions' && !fake) {
    const slug = await githubSlugFor(cwd)
    const token = await githubToken(cwd)
    if (!slug) {
      return await abortBeforeDriver('--run-on actions needs a GitHub origin remote on this repo.')
    }
    if (!token) {
      // Both ways out, because neither is guessable from the other: the env var is what CI sets,
      // and `gh auth login` is what a laptop has. Says which process needs it, too — the daemon
      // hands each run its own environment, so exporting the variable in a shell does nothing for
      // a daemon that is already up.
      return await abortBeforeDriver(
        '--run-on actions needs a GitHub user token (repo + workflow scopes): set GH_TOKEN in the environment ' +
          'the daemon runs in, or log in with `gh auth login`. It must belong to a user, not an App — the agent ' +
          'workflow refuses a bot-triggered run.',
      )
    }
    actionsConfig = { owner: slug.owner, repo: slug.repo, token }
    io.out(`◆ run on: GitHub Actions (${slug.owner}/${slug.repo})`)
  }

  // Run on Claude Code on the web (#610). Nothing to resolve: the CLI holds the account the
  // cloud session is created under, so there is no token of ours and no repo config. The
  // session clones this repo's remote at its current branch, so local commits that were never
  // pushed are not in it — say so once here rather than let the cloud session look stale.
  if (opts.target === 'web' && !fake) {
    io.out('◆ run on: Claude Code on the web (a cloud session on your own account)')
    if (!(await githubSlugFor(cwd))) {
      io.out('  no GitHub remote here, so the CLI uploads a bundle of this repo instead.')
    }
  }

  const driver: Driver = fake
    ? fakeDriver()
    : createRunDriver({
        agent: opts.agent,
        claudeOpts: withBrowser(claudeOpts, opts.browser, sharedBrowser?.browserUrl),
        ...(opts.target ? { target: opts.target } : {}),
        ...(actionsConfig ? { actionsConfig } : {}),
      })

  // Whether the agent actually ends up with browser tools, which is narrower than the flag: they
  // ride Claude Code's MCP config, so `--browser` on another agent wires nothing (see
  // `unguardedNotices`), the fake driver has no tools at all, and a remote target never sees
  // this machine's MCP config. The system channel must only claim a browser the run really has (#824).
  const browserAttached = opts.browser && !fake && opts.agent === 'claude' && localRun

  // The preview of that browser (#802): the agent's Chrome is headless, so when it parks on an
  // `await-browser` gate (#796) there is nothing for a human to click. This serves it. Opening
  // the stream costs nothing while the page is still — Chrome only emits a frame on a change.
  const browserStream = sharedBrowser
    ? await startBrowserStream({
        browserUrl: sharedBrowser.browserUrl,
        connect: connectCdp,
        // Every real page the preview shows lands in the transcript (#1455 item 6b), so the
        // inline pane appears at the point of use rather than only in the rail.
        onPage: url => journal.announceBrowserUrl(url),
      }).catch(() => undefined)
    : undefined
  // The port travels as an event — persisted and published live — because a dashboard-started
  // run is spawned with its stdout discarded, so a printed URL reaches nobody (#813). The
  // journal holds it until the session opens: the bridge exists before the run does, and an
  // event ahead of `session` never reaches the dashboard (#829).
  if (browserStream) journal.announceBrowserPort(browserStream.port)

  // The quota boundary (#879). Nothing to configure and nothing to pass: the
  // boundary is derived from the account's own week, so a run started from a
  // terminal is gated exactly like one started from the dashboard. `undefined`
  // when the agent can't report a quota (the fake driver, or Codex), which
  // leaves the run ungated — the fail-open Rom confirmed.
  // Transparent mode (#625) leaves the run fully raw, so the guard is off with it — the run is
  // `claude -p` with no framework behavior, spend included.
  const guard = transparent
    ? undefined
    : startConsumptionGuard({
        driver,
        // The #960 slider joins the per-run gate (#1490), read from the registry the same way
        // the daemon's quota source reads it — so the Usage bar and this gate cannot disagree.
        limitOffset: async () => (await readPreferences()).autoSpendOffset ?? DEFAULT_SPEND_OFFSET,
        ...(opts.model ? { model: opts.model } : {}),
      })
  if (transparent) io.out(`◆ transparent: on — raw ${AGENT_SPECS[opts.agent].label}, no framework prompt, guard, dashboard, or TODO loop`)
  else if (guard) io.out('◆ quota boundary: on')
  else if (!fake) {
    io.out(`◆ quota boundary: off — ${AGENT_SPECS[opts.agent].label} reports no quota, so nothing gates your subscription spend.`)
  }

  // A user SYSTEM.md + the anti-lazy-pill toggle shape the system prompt (#301), and the eco
  // flags trim the built-in one (#314). Resolve and echo once, shared by both run paths.
  const promptConfig = await resolvePromptConfig(opts, config, cwd, io, transparent)

  // The run-scoped state both run paths hand to settleRun to close out. stoppedCleanly is a
  // getter because the onEvent sink sets it as the `end` event arrives.
  const epilogue = (failLabel: string): RunEpilogue => ({
    io,
    store,
    control,
    guard,
    sharedBrowser,
    browserStream,
    clearInterrupt,
    maybeFireOnBeforeMergeable,
    maybeAutoHandoff,
    finishLog: journal.finishLog,
    isStopped: () => controller.signal.aborted || journal.stoppedCleanly(),
    failLabel,
  })

  // The options both run paths pass through unchanged: who the agent is, what it may spend, what
  // it reads, and who can answer it. They were written out twice, thirteen conditional spreads
  // each, so a new one had to be added to both by hand — and a run started as a build and a run
  // started as a prompt are the same run in every respect but the scaffolding around the prompt.
  // A project-less topic run (#1120) can bind to a project mid-run via an await gate (#1121): the
  // resolver lists / registers projects against the real registry and signals the bind over the
  // control channel, which the watcher above folds to the run's meta. Topic runs only.
  const bindDeps: BindProjectDeps | undefined = opts.topic
    ? {
        listProjects: () => listProjects(),
        addProject: async path => {
          // Validate before touching the registry: a relative / missing / non-directory path
          // declines cleanly back to the agent rather than landing junk in the home file (#1121).
          const resolved = await resolveProjectPath(path)
          if (!resolved.ok) return { ok: false, error: resolved.error }
          const already = (await listProjects()).some(p => p.path === resolved.path)
          const record = await addProject(resolved.path, new Date().toISOString())
          return { ok: true, project: { id: record.id, path: record.path }, created: !already }
        },
        recordBind: projectId => void appendControl(cwd, { kind: 'bind', projectId }),
      }
    : undefined

  const sharedRunOptions = {
    driver,
    cwd,
    onEvent,
    signal: controller.signal,
    ...(opts.topic ? { topic: true } : {}),
    ...(bindDeps ? { bind: bindDeps } : {}),
    ...(requestChoice ? { requestChoice } : {}),
    ...chatQueue,
    ...(recordMessage ? { recordMessage } : {}),
    ...(opts.model ? { model: opts.model } : {}),
    ...(opts.maxCost ? { budgetUsd: opts.maxCost } : {}),
    ...(guard ? { consumptionGate: guard.gate } : {}),
    ...(promptConfig.userSystemPrompt ? { systemPrompt: promptConfig.userSystemPrompt } : {}),
    ...(promptConfig.noBuiltinPrompt ? { vanilla: true } : {}),
    ...(browserAttached ? { browser: true } : {}),
    ...(transparent ? { transparent: true } : {}),
    ...(opts.context.length ? { context: opts.context } : {}),
    ...(sessionLink ? { sessionLink } : {}),
  }

  // Which prompt opens the session, and whether its backlog is worked afterwards (D2). A `prompt`
  // session runs its text verbatim — it may already BE an edited preset, so it must not be
  // re-rendered — and research renders its preset template around the "what" first. Transparent
  // (#625) joins them: "raw Claude Code" must bypass the build framing too, not just zero the
  // system prompt. A build continuation (#1467) stays a build despite arriving as a `prompt`
  // start: the flow it re-enters is the one recorded on its own meta.
  const isResearch = opts.research && !transparent
  const kind: SessionKind = (opts.research || opts.directPrompt || transparent) && !continueBuild ? 'prompt' : 'build'
  const label = kind === 'build' ? 'session' : isResearch ? 'research' : 'prompt session'

  const runOpts: RunSessionOptions = {
    ...sharedRunOptions,
    kind,
    ...(opts.target ? { location: opts.target } : {}),
    prompt: isResearch ? presets.research.render(intent) : intent,
    // Resume the stopped leg's conversation (#720/#1467); the prompt above is the continuation
    // message, which `runSession` then sends verbatim.
    ...(opts.resumeSession ? { resumeSessionId: opts.resumeSession } : {}),
    ...(opts.todoLoop && !transparent ? {} : { todoLoop: false }),
    ...(opts.todoMaxItems ? { todoMaxItems: opts.todoMaxItems } : {}),
  }

  return settleRun(epilogue(label), async () => {
    await runSession(runOpts)
    // A hand-off ends at the hand-off (#1225): "done" would claim this machine built something
    // it never saw.
    const successLine = isHandsOff(opts.target)
      ? '\n✓ handed off. The session continues where it was sent, and opens its own pull request.'
      : isResearch
        ? '\n✓ research done: see the REVIEW-PROBLEMS / TODO files it wrote.'
        : kind === 'prompt'
          ? '\n✓ prompt session done.'
          : '\n✓ done.'
    return { successLine }
  })
}

/**
 * Bare `framework` (no prompt): run the dashboard server in the foreground (#456), so its logs and
 * any server-thrown errors are visible and Ctrl+C stops it — along with every session it is
 * running, which is the only mode there is. Blocks until the server is signalled (SIGINT/SIGTERM).
 */
async function runForegroundDaemonCmd(args: CliArgs, io: CliIO): Promise<number> {
  const cwd = process.cwd()
  const port = args.port ?? DEFAULT_DAEMON_PORT
  const host = args.host
  // #1051: pre-generate the shared token for a non-loopback bind so onListening (sync) can print
  // the reachable URL; runDaemon reuses the same persisted token.
  const token = host !== undefined && !isLoopbackHost(host) ? await ensureDaemonToken() : undefined
  try {
    await runDaemon(cwd, {
      port,
      ...(host !== undefined ? { host } : {}),
      onListening: state => {
        io.out(`◆ dashboard running: ${state.url}`)
        if (!isLoopbackHost(state.host ?? DEFAULT_DAEMON_HOST)) {
          printNonLoopbackAccess(io, state.host ?? DEFAULT_DAEMON_HOST, state.url, token)
        }
        io.out('  Ctrl+C to stop the dashboard and every session it is running. Server logs stream below.')
        // #312 asks bare `framework` to print the commands + version too. onListening is sync and
        // runDaemon then blocks until signalled, so this is fire-and-forget by necessity: the
        // update line lands a moment later, above the server logs.
        void printStartupFooter(io)
      },
    })
  } catch (err) {
    io.err(`could not start the dashboard (${errorMessage(err)}).`)
    return 1
  }
  return 0
}

/**
 * The loud one-line warning and the token-bearing URL printed on any non-loopback daemon bind
 * (#1051). A daemon that spawns processes is code execution for anyone who reaches the port, and
 * the shared token is the only guard, so this says so before the daemon is left running. The bound
 * host is a bind-all like `0.0.0.0`, so the user swaps it for the machine's actual reachable
 * address (a Tailscale/LAN hostname); the token rides the URL for the first hop, then the cookie.
 */
function printNonLoopbackAccess(io: CliIO, host: string, url: string, token: string | undefined): void {
  io.err(`⚠ SECURITY: bound to ${host} (non-loopback). This exposes code execution to your network; the shared token is the only guard (#1051).`)
  if (!token) return
  io.out(`  Open with the token (swap ${host} for this machine's reachable address, e.g. a Tailscale hostname):`)
  io.out(`    ${url}/?token=${token}`)
}

/**
 * The startup footer every dashboard path prints (#312): the convenience commands, the version,
 * and then — once npm answers — whether that version is the latest.
 *
 * The update line is deliberately not awaited before the static lines. #312 asks for the static
 * info first, and the foreground path (bare `framework`) blocks on the server forever, so a line
 * printed after the await would never appear there at all. `checkForUpdate` is already forgiving:
 * offline or slow (2.5s cap) resolves to 'unknown', which prints nothing.
 */
export function printStartupFooter(io: CliIO, opts: { fetchLatest?: VersionFetcher } = {}): Promise<void> {
  const version = frameworkVersion()
  io.out('')
  io.out('Type a prompt on the dashboard to start a session, or use:')
  io.out('  framework "<what to build>"   Build (streams to the dashboard)')
  io.out('  framework --help              All options')
  io.out('')
  io.out(`The Framework v${version}`)
  return checkForUpdate(version, opts.fetchLatest ?? nodeVersionFetcher())
    .then(status => {
      const line = formatUpdateStatus(status)
      if (line) io.out(line)
    })
    .catch(() => {})
}

/**
 * The session spec a spawned on-before-mergeable child runs with (D4). Pure so a test can assert
 * it: note it carries **no** `onBeforeMergeable`, which is the recursion guard — a quality pass
 * must not trigger its own suite.
 */
export function promptRunSpec(prompt: string, cwd: string, maxCost?: number, vanilla = false): SessionSpec {
  return {
    prompt,
    kind: 'prompt',
    cwd,
    options: {
      ...(maxCost !== undefined ? { maxCost } : {}),
      // The on-before-mergeable follow-up runs vanilla so it skips the #326 prompt's `### Session
      // name` step: it is a follow-up to a session, not a session of its own, so it must not
      // commit + branch + checkout a new `the-framework/<name>` branch. That stranded its output
      // (the #556 TODO entries and #537 knowledge docs) on a branch nothing merges (#560). Vanilla
      // keeps it on the session's current branch, where its output rides to review and merge with
      // the work. The follow-up prompt is self-contained.
      ...(vanilla ? { vanilla: true } : {}),
    },
  }
}

/**
 * Run one direct prompt by spawning `framework --session <spec>`, reusing the whole run path
 * (preflight, driver, budget cap, LOGS.md). The child inherits stdio so its run streams to the
 * terminal. Note the spec carries no `onBeforeMergeable`, so a quality pass never triggers its own
 * on-before-mergeable prompt (the recursion guard). Resolves true on a clean exit (0). Never
 * re-execs a test entry (fork-bomb guard).
 */
async function spawnPromptRun(prompt: string, cwd: string, binPath: string, maxCost?: number, vanilla = false): Promise<boolean> {
  if (process.env.NODE_TEST_CONTEXT || /\.test\.[cm]?[jt]s$/.test(binPath)) {
    return false // refuse to spawn from a test entry
  }
  const specPath = await writeSessionSpec(promptRunSpec(prompt, cwd, maxCost, vanilla))
  return new Promise<boolean>(resolvePromise => {
    const child = spawn(process.execPath, [binPath, '--session', specPath], { stdio: 'inherit' })
    child.once('error', () => resolvePromise(false))
    child.once('exit', code => resolvePromise(code === 0))
  })
}

/** How the on-before-mergeable prompt is spawned; injectable so tests observe it without spawning. */
export type PromptRunner = (prompt: string, cwd: string, binPath: string, maxCost?: number) => Promise<boolean>

/**
 * Fire the #326 on-before-mergeable prompt after a run signalled setReadyForMerge(): one
 * `framework prompt` child on the same workspace that appends the quality follow-ups to the
 * session's TODO file, for the backlog loop (#323/#538) to pick up.
 *
 * It used to run maintainability, readability and security-audit inline instead, as three
 * child runs back to back (#556). Queueing is both what the doc says and the cheaper thing:
 * one short turn that writes a few TODO lines, rather than three full preset passes serialized
 * on the same git index. Best-effort, like the suite was: a failure is logged, never thrown.
 *
 * Returns how it went so the caller can emit it as an event (#835); the `io` lines stay for
 * a terminal run, which is the one surface that can still read them.
 */
export async function runOnBeforeMergeable(
  cwd: string,
  binPath: string,
  io: CliIO,
  tf: OnBeforeMergeableContext,
  maxCost?: number,
  // Vanilla by default: the follow-up must not run the session-name step and branch (#560).
  run: PromptRunner = (prompt, cwd, binPath, maxCost) => spawnPromptRun(prompt, cwd, binPath, maxCost, true),
  fs: StoreFs = nodeStoreFs(),
): Promise<'queued' | 'incomplete'> {
  // Ensure the presets exist so the queued entries' filePaths resolve, even in a repo
  // activated before they shipped or a fresh clone (they are gitignored) (#598). Best-effort,
  // like the rest of this run: a materialize failure must not block the queueing.
  try {
    await materializePresets(cwd, fs)
  } catch (err) {
    io.out(`  ! on-before-mergeable: could not materialize presets (${errorMessage(err)})`)
  }
  io.out(`\n◆ on-before-mergeable: queueing quality follow-ups for ${tf.session_name}`)
  const ok = await run(renderOnBeforeMergeablePrompt(tf), cwd, binPath, maxCost)
  if (!ok) io.out(`  ! on-before-mergeable queueing did not complete cleanly.`)
  return ok ? 'queued' : 'incomplete'
}


/** Resolve when the process is interrupted (Ctrl+C), so the dashboard stays up. */
function waitForInterrupt(): Promise<void> {
  return new Promise(resolvePromise => {
    const done = () => {
      process.off('SIGINT', done)
      process.off('SIGTERM', done)
      resolvePromise()
    }
    process.once('SIGINT', done)
    process.once('SIGTERM', done)
  })
}
