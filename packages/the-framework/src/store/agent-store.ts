import type { AgentLocation } from '../agent-location.js'
import { join } from 'node:path'
import { hostname } from 'node:os'
import type { FrameworkEvent } from '../events.js'
import { nodeFs } from '../node-fs.js'

/**
 * Persisted orchestration state (#211). The dashboard is a pure projection of the
 * {@link FrameworkEvent} stream, so persisting *is* durably logging that stream:
 * the stack rationale, the loop status, and the decisions ledger are all events
 * that already flow through it. We store the log append-only and rehydrate a
 * restarted dashboard by replaying it into a fresh stream — no separate state
 * model to keep in sync. Per the sync, we do **not** persist the agent's chat
 * transcript (Claude Code owns that); only our own orchestration events.
 */

/**
 * The directory, under the workspace root, that holds the persisted run. Same
 * `.the-framework/` directory as the committed project log (#313): one dir holds
 * both the transient run state (events.jsonl / agent.json / agents/) and the DB
 * (LOGS.md); a seeded `.the-framework/.gitignore` keeps the run state untracked.
 */
export const FRAMEWORK_DIR = '.the-framework'

/**
 * Per-run worktrees live under `<repo>/.the-framework/worktrees/` (#736). Kept out of git by
 * the install-time `.the-framework/.gitignore` (`*` rule, #313), so a worktree's checkout never
 * shows up as dirty in the parent. Declared here beside {@link FRAMEWORK_DIR} rather than in
 * `worktree.ts`, which imports from this module: {@link readLiveMetas} needs it to find the
 * runs living in those worktrees, and the other direction would be an import cycle.
 */
export const WORKTREES_DIR = 'worktrees'

/** The append-only event log: one {@link FrameworkEvent} per line (JSONL). */
export const EVENTS_FILE = 'events.jsonl'

/** A small snapshot for cheap status reads without replaying the whole log. */
export const META_FILE = 'agent.json'

/**
 * Where finished runs are archived, so the dashboard can list a project's run
 * history (#303). The live run stays at `events.jsonl`/`agent.json` (the daemon
 * tails it); on {@link AgentStore.close} a copy lands here as `<id>.jsonl` +
 * `<id>.json`, giving the history sidebar a per-run log to replay.
 */
export const AGENTS_DIR = 'agents'

/**
 * Where a project's finished runs are archived now (#1179): `.the-framework/<user>/sessions/`,
 * which the install-time ignore un-ignores so the history is committed and survives a
 * `git clean -fdx`. {@link AGENTS_DIR} stays the transient location — a run worktree still archives
 * into its own throwaway checkout there, and it is where every run archived before this shipped
 * still lives, so both are read.
 *
 * The name lives here beside its sibling rather than in `sessions.ts`, which owns the per-user
 * naming: that module reads the store, so the constant travelling the other way would be a cycle.
 */
export const ARCHIVE_DIR = 'agents'

/** Filesystem-safe, lexicographically-sortable run id from an ISO start time. */
export function agentIdFromStartedAt(startedAt: string): string {
  // ISO is fixed-width, so replacing the `:`/`.` separators keeps lexical order
  // in step with chronological order — the history list sorts by id alone.
  return startedAt.replace(/[:.]/g, '-')
}

/** A run id is path-safe: no separators or traversal, only our own charset. */
export function isSafeRunId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id)
}

/**
 * The inverse of {@link agentIdFromStartedAt}, for a caller that has the id but not the meta
 * (#1251): the CLI's end-of-run handoff needs the start time to tell the run's own PR from a
 * predecessor's on the same branch name. Undefined for an id that is not one of ours.
 */
export function startedAtFromAgentId(id: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(id)
  return match ? `${match[1]}:${match[2]}:${match[3]}.${match[4]}Z` : undefined
}

/** Bumped when the on-disk shape changes, so a reader can detect an old file. */
export const AGENT_META_VERSION = 2

/** How a run ended (or that it is still going). */
export type AgentStatus = 'running' | 'done' | 'stopped' | 'failed'

/**
 * A queryable snapshot of the run, derived entirely from the event log. Lets the
 * dashboard render a header (and a future run list) without parsing every line.
 */
export interface AgentMeta {
  version: number
  status: AgentStatus
  /** Stable, path-safe id for this run (derived from {@link startedAt}). */
  id: string
  /** ISO timestamp the store was opened (run start). */
  startedAt: string
  /** ISO timestamp of the last event written. */
  updatedAt: string
  /**
   * The OS pid of the process that owns this run (the one tailing `control.jsonl`), on {@link host}.
   * Persisted so a reader can tell a live run from one whose process died without writing `end`
   * (#716): a `running` meta whose owning pid is gone is stale and gets flipped to `stopped`.
   */
  pid?: number
  /** The host the owning {@link pid} lives on, so a pid probe only trusts a match (#716). */
  host?: string
  /** What this session was asked for (from the `intent` event). */
  intent?: string
  /** The wrapped agent (from the `session` event). */
  driver?: string
  /** The workspace the agent builds in (from the `session` event). */
  workspace?: string
  /** The wrapped agent's real session id, once it reports one. */
  sessionId?: string
  /** The link shown to jump into the live agent session. */
  sessionLink?: string
  /** The session name the agent chose (#326), also its `the-framework/<name>` branch. */
  sessionName?: string
  /**
   * The branch the run's work is on: folded from `branch` events as the run observes it (#1277),
   * and corrected at teardown while the worktree still exists (#799).
   *
   * Not reliably derivable instead of recorded: a clean run loses its checkout, and the #326
   * prompt lets the agent create its own branch, so neither `the-framework/<sessionName>` nor
   * the run-id branch is guaranteed to be the one holding the commits.
   */
  branch?: string
  /**
   * The ticket this run is implementing (#1117), repo-relative (`tickets/<file>.md`).
   *
   * Set only when the framework picked the ticket itself, so the Overview can show a ticket that is
   * being coded right now as `implementing` instead of inferring it from the plan/spike it left
   * behind. Absent on every run nobody linked to a ticket.
   */
  ticket?: string
  /**
   * The pull request this session's work is on (E6), recorded when one is opened rather than
   * re-derived from branch names and timestamps by every surface that wants it.
   */
  pr?: { number: number; url: string }
  /** Whether the agent signalled `setReadyForMerge()` (#326): building (false/absent) vs ready (true). */
  readyForMerge?: boolean
  /**
   * What this session's end-of-session handoff is armed to do (#1102): push its branch, and open
   * a draft PR for it. Both start on.
   *
   * On the meta because the checkboxes that show it live in a different process from the run that
   * obeys it, and a tab opened after the run started has no event history to fold — the same
   * reason {@link browserStreamPort} is here. Absent means an older run, which the reader treats
   * as armed, matching what that run will actually do.
   *
   * `merge` mirrors the auto-merge arming (#1216, #1382) — display-only, like the rest of this
   * field: the run merges off its own config, never off the meta. Absent on records from before
   * #1382, which the reader treats as off.
   */
  handoff?: { push: boolean; pr: boolean; merge?: boolean }
  /**
   * How the end-of-session handoff reported back (#1455), folded from the `handoff` event.
   *
   * What lets a list surface — which reads meta, not the event log — tell "ended, still
   * publishing" from "ended, published": between a clean `end` and this field, an armed run's
   * epilogue is still pushing / opening the PR, exactly the window the session pill calls
   * "publishing…" (#1431). Only trustworthy at {@link AgentMeta.version} ≥ 2: older records never
   * folded the event, so its absence there says nothing and must not read as forever-publishing.
   */
  handoffReport?: 'done' | 'skipped' | 'failed'
  /**
   * How the handoff's merge half went (#1418), folded from the `handoff` event's `merge` field.
   *
   * What the daemon's CI watch scans for: `watched` is a PR waiting for green that *this* side
   * must merge (the repo could not arm GitHub auto-merge), `auto-armed` one GitHub will land by
   * itself but whose checks going red is still ours to notice. On the meta because the watch
   * reads metas, not event logs, and must survive both the run's process and the daemon's.
   * Absent on runs from before this field, and on every run whose handoff had no merge to report.
   */
  mergeOutcome?: 'auto-armed' | 'merged' | 'watched' | 'withheld' | 'failed'
  /**
   * The choice gate the run is currently parked on (#636): set when a `choice` event fires and
   * cleared when its `choice-resolved` (or the run's `end`) arrives. Present means the run is
   * paused waiting for the user's answer — the second "needs you" source after open PRs (#624).
   */
  pendingChoice?: { id: string; title: string }
  /**
   * When the run settled and parked on the user (#785), or absent while the agent is working.
   *
   * Deliberately not a {@link AgentStatus} value: the run IS still live while it waits (its
   * process is alive, it still takes messages, it still holds the project), and a dozen readers
   * key "live" off `status === 'running'`. This is the orthogonal fact — working, or waiting on
   * you — which `status` cannot carry because it only changes when the run ends.
   */
  settledAt?: string
  /**
   * The loopback port the run's browser preview is listening on (#813), or absent when the run
   * has no browser. What lets the daemon proxy the pane: the port is allocated per run and the
   * dashboard is a different process, so meta is the only place it can learn it.
   */
  browserStreamPort?: number
  /**
   * Where this run executes (#1050/#1053/#610): `actions` for a GitHub Actions run, `web` for a
   * Claude Code cloud session, `remote` when relayed to a connected device (#1067), absent for a
   * local run. Persisted so the run view can tell a burst-mode Actions run from a stalled live
   * feed, show a cloud run's session link after a reload, and gate the browser pane off (#1053).
   */
  target?: 'local' | 'actions' | 'remote' | 'web'
  /** The connected device a remote run (#1067) executes on, for the session list + notice after a reload. */
  remoteLabel?: string
  /**
   * The flow this run started under (#1467): `build` for the scope→build orchestration, `prompt`
   * for the direct-prompt path (research and transparent runs record `prompt` too). Persisted so a
   * continuation (#762) can re-enter the flow its first leg ran — the composer's Resume always
   * arrives as a `prompt` start, and without this record a resumed build run ended as a bare
   * prompt session (no synthesize framing, no backlog offer). Absent on records from before this
   * field, which a reader treats as unknown (the continuation then keeps the prompt path).
   */
  kind?: 'build' | 'prompt'
  /**
   * The model id the current leg's agent was started with (#1438), folded from each leg's
   * `session` event — a continuation (#762) may run a different model than the first leg, so
   * the latest leg wins rather than the first pinning it. Absent when the leg left the agent
   * on its own default (and on records from before this field).
   */
  model?: string
}

/**
 * The slice of a filesystem {@link AgentStore} needs. Mirrors the `LedgerFs` seam
 * in ai-autopilot's decisions store: the store logic is pure and testable with an
 * in-memory fs, and only {@link nodeStoreFs} touches disk.
 */
export interface StoreFs {
  read(path: string): Promise<string>
  write(path: string, contents: string): Promise<void>
  append(path: string, contents: string): Promise<void>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  /** List a directory's entries (names only). Missing dir yields `[]`. */
  readdir(path: string): Promise<string[]>
  /**
   * Replace `to` with `from` in one step. Optional: an adapter that has it gets torn-proof meta
   * writes (see {@link writeMetaFile}), and one that does not writes in place, which is right for
   * the in-memory fakes — a `Map.set` cannot be observed half-done.
   */
  rename?(from: string, to: string): Promise<void>
}

/** Options for {@link AgentStore.open}. */
export interface OpenStoreOptions {
  /** The filesystem adapter. Default {@link nodeStoreFs}. */
  fs?: StoreFs
  /**
   * Truncate any prior log so this is a clean run (MVP: one run per workspace).
   * `false` (the default) opens read-only-ish for {@link AgentStore.loadEvents} —
   * the `--resume` path — and does not clear the log.
   */
  fresh?: boolean
  /** The wall-clock start, ISO. Injectable so tests are deterministic. */
  now?: string
  /**
   * Reads the current time for each appended event, so {@link AgentMeta.updatedAt} tracks the last
   * event rather than the run's start. Injectable so tests can step it deterministically.
   *
   * Separate from {@link now} on purpose: `now` is when the run *opened*, and a single timestamp
   * cannot answer both questions. Reusing it for appends froze `updatedAt` at `startedAt` for a
   * run's whole life, which every reader that orders by recency (the overview, the activity feed,
   * the interventions queue) silently sorted on.
   */
  clock?: () => string
  /**
   * The session's intent (its prompt / request) shown in the dashboard's sessions list. Seeded
   * here so the row shows the prompt from the moment the store opens, before the session's own
   * `intent` event lands; refreshed by that event.
   */
  intent?: string
  /**
   * Who owns this run (#716). Defaults to the current process on this host — the process opening a
   * fresh store *is* the run's owner. Injectable so tests can seed a specific (dead) pid.
   */
  owner?: AgentOwner
  /**
   * The run's id, overriding the one derived from {@link OpenStoreOptions.now}. The daemon
   * allocates the id before it spawns the run (it names the run's worktree with it, #736) and
   * passes it in, so the worktree directory and the run inside it are one string rather than two
   * timestamps taken a moment apart. Ignored unless path-safe.
   */
  id?: string
  /**
   * Reopen the run already at this path instead of starting a new one (#762): keep its event log
   * and its original intent, and flip it back to `running` under this process. What makes a
   * continued run one row in the history rather than two: the follow-up is a second process, but
   * it writes into the same run.
   *
   * Falls back to a fresh run when there is nothing to reopen.
   */
  continueRun?: boolean
  /** Where this run executes (#1053/#610): recorded on the meta so the run view can read it. */
  target?: AgentLocation
  /** The flow this run started under (#1467): recorded on the meta so a continuation can re-enter it. */
  kind?: 'build' | 'prompt'
}

/**
 * Fold one event into the running {@link AgentMeta}. Pure, so the same derivation
 * drives both a live append and reconstructing meta from a replayed log.
 */
export function applyEventToMeta(meta: AgentMeta, event: FrameworkEvent, at: string): AgentMeta {
  const next: AgentMeta = { ...meta, updatedAt: at }
  switch (event.kind) {
    case 'session':
      next.driver = event.driver
      next.workspace = event.workspace
      if (event.sessionLink) next.sessionLink = event.sessionLink
      // Per-leg (#1438): a leg that recorded no model leaves it unknown rather than
      // inheriting the prior leg's — the agent may have resolved a different default.
      if (event.model) next.model = event.model
      else delete next.model
      break
    case 'session-update':
      next.sessionId = event.sessionId
      if (event.sessionLink) next.sessionLink = event.sessionLink
      break
    case 'session-name':
      next.sessionName = event.name
      break
    case 'ready-for-merge':
      next.readyForMerge = true
      break
    case 'choice':
      next.pendingChoice = { id: event.id, title: event.title }
      break
    case 'choice-resolved':
      if (next.pendingChoice?.id === event.id) delete next.pendingChoice
      break
    case 'intent':
      next.intent = event.text
      break
    case 'browser-stream':
      next.browserStreamPort = event.port
      break
    case 'handoff-armed':
      next.handoff = { push: event.push, pr: event.pr, ...(event.merge !== undefined ? { merge: event.merge } : {}) }
      break
    case 'handoff':
      next.handoffReport = event.outcome
      if (event.outcome !== 'failed' && event.merge) next.mergeOutcome = event.merge.outcome
      break
    case 'ticket':
      next.ticket = event.path
      break
    case 'pull-request':
      next.pr = { number: event.number, url: event.url }
      break
    case 'branch':
      next.branch = event.branch
      break
    case 'settled':
      next.settledAt = at
      break
    case 'driver':
      // Any new turn means the agent is working again, so the run is no longer parked (#785).
      if (event.event.type === 'start') delete next.settledAt
      break
    case 'end':
      next.status = event.ok ? 'done' : event.stopped ? 'stopped' : 'failed'
      delete next.pendingChoice // a finished run is not awaiting anything
      delete next.settledAt // nor is it waiting on you
      // The bridge dies with the run, so a kept port would send the pane at whatever else
      // the OS handed that number next.
      delete next.browserStreamPort
      break
    default:
      break
  }
  return next
}

/** Who owns a live run: its OS pid and the host that pid lives on (#716). */
export interface AgentOwner {
  pid: number
  host: string
}

/** The seed meta a run starts from, before any event is folded in. */
function freshMeta(
  startedAt: string,
  intent?: string,
  owner?: AgentOwner,
  id?: string,
  target?: AgentLocation,
  kind?: 'build' | 'prompt',
): AgentMeta {
  return {
    version: AGENT_META_VERSION,
    status: 'running',
    id: id && isSafeRunId(id) ? id : agentIdFromStartedAt(startedAt),
    startedAt,
    updatedAt: startedAt,
    ...(owner ? { pid: owner.pid, host: owner.host } : {}),
    ...(intent ? { intent } : {}),
    // Only a non-local target travels; `local` is the default every reader already assumes.
    ...(target && target !== 'local' ? { target } : {}),
    ...(kind ? { kind } : {}),
  }
}

/**
 * Parse a JSONL event log. A blank or malformed trailing line (e.g. a crash
 * mid-write) stops the read rather than throwing, so a partial run still replays
 * everything up to the cut.
 */
function parseEventLog(raw: string): FrameworkEvent[] {
  const events: FrameworkEvent[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      events.push(JSON.parse(trimmed) as FrameworkEvent)
    } catch {
      break // a torn last line from an interrupted write; keep what we have
    }
  }
  return events
}

/** How many times a meta that would not parse is re-read before it is called corrupt (#1540). */
const TORN_META_READ_RETRIES = 2

/** The pause between those re-reads: long enough for the write that tore the read to land. */
const TORN_META_READ_DELAY_MS = 5

/**
 * Read + parse a persisted {@link AgentMeta} file, or `undefined` if missing/unreadable.
 *
 * Re-read on a parse failure (#1540). {@link writeMetaFile} closes this off at the source, so this
 * is the backstop rather than the defence: a meta written by an older CLI still on a plain
 * in-place write — a daemon reading a run started before an upgrade — can still be caught
 * mid-truncate, and reporting that as `undefined` makes a live run *vanish* from every composed
 * read for one poll. A torn read is transient by construction, so ask again; a file still
 * unparseable after the retries is genuinely corrupt and yields `undefined`, exactly as before.
 */
async function readMetaFile(fs: StoreFs, path: string): Promise<AgentMeta | undefined> {
  for (let attempt = 0; ; attempt++) {
    if (!(await fs.exists(path))) return undefined
    try {
      return JSON.parse(await fs.read(path)) as AgentMeta
    } catch {
      if (attempt >= TORN_META_READ_RETRIES) return undefined
      await new Promise(resolve => setTimeout(resolve, TORN_META_READ_DELAY_MS))
    }
  }
}

/**
 * Write a {@link AgentMeta} file. The one owner of the on-disk encoding, symmetric to
 * {@link readMetaFile} — every meta write in this module goes through it.
 *
 * Written beside the target and renamed over it (#1540). A meta is rewritten by the run that owns
 * it, over and over, while the daemon and every dashboard read poll it from another process; a
 * plain write truncates the file before it refills, so a reader landing in that window saw an
 * empty one and reported the run *gone*. A rename swaps the whole file in one step, so a reader
 * gets either the entire previous meta or the entire new one and never a half of either — which
 * {@link readMetaFile}'s retry can only paper over, never prevent. An adapter with no `rename`
 * writes in place as before.
 */
async function writeMetaFile(fs: StoreFs, path: string, meta: AgentMeta): Promise<void> {
  const contents = JSON.stringify(meta, null, 2) + '\n'
  if (!fs.rename) return fs.write(path, contents)
  // Named for the writing process: a run and the daemon teardown archiving it can both be
  // writing the same meta, and they must not share a scratch file and splice their writes into
  // one. `.tmp` also keeps it out of the archive listing, which takes only `.json`.
  const scratch = `${path}.${process.pid}.tmp`
  await fs.write(scratch, contents)
  await fs.rename(scratch, path)
}

/**
 * The `end` event written on behalf of a run whose process died without reporting one (#1359):
 * a crash, a `kill -9`, or the empty-event-loop exit a parked gate used to cause. Every reader
 * of the stream — the dashboard's outcome pill, its choice rail, the meta fold — keys "over"
 * off a single `end` event, so a death that skipped it left the run's last question rendering
 * as answerable forever while its picks were read by nobody.
 */
function orphanEndEvent(): FrameworkEvent {
  return { kind: 'end', ok: false, stopped: true, detail: 'its process died without reporting an end' }
}

/**
 * Record a dead run's missing ending in place (#1359): append the surrogate `end` event to the
 * checkout's live log and fold it into the meta via {@link applyEventToMeta} — so the status
 * flips to `stopped` and a `pendingChoice` the run died holding expires exactly as a run-written
 * end would expire it. Best-effort on both writes: healing must never make a read throw.
 */
async function recordOrphanEnd(fs: StoreFs, dir: string, meta: AgentMeta): Promise<AgentMeta> {
  const event = orphanEndEvent()
  await fs.append(join(dir, EVENTS_FILE), JSON.stringify(event) + '\n').catch(() => {})
  const ended = applyEventToMeta(meta, event, new Date().toISOString())
  await writeMetaFile(fs, join(dir, META_FILE), ended).catch(() => {})
  return ended
}

/**
 * Flip the live run at `dir` to `stopped` and archive it, returning the stopped meta. The
 * shared tail of every self-heal: a `running` meta whose process is gone must both stop
 * showing as live and keep its history. The flip goes through {@link recordOrphanEnd}, so
 * the log gains the `end` event the dead process never wrote (#1359) before the archive
 * copies it. Best-effort on both writes — healing must never make a read throw.
 */
async function stopAndArchiveLive(fs: StoreFs, dir: string, meta: AgentMeta): Promise<AgentMeta> {
  const stopped = await recordOrphanEnd(fs, dir, meta)
  await archivePriorRun(fs, dir).catch(() => {})
  return stopped
}

/** Rebuild {@link AgentMeta} from a full event log (used when resuming). */
export function metaFromEvents(events: readonly FrameworkEvent[], startedAt: string): AgentMeta {
  let meta = freshMeta(startedAt)
  for (const event of events) meta = applyEventToMeta(meta, event, startedAt)
  return meta
}

/**
 * Durable, append-only store for a single run's orchestration events, plus a
 * derived {@link AgentMeta} snapshot. Writes are serialized through one tail
 * promise so an append and its meta rewrite never interleave; {@link close}
 * flushes that queue before the process exits.
 */
export class AgentStore {
  private tail: Promise<void> = Promise.resolve()
  private meta: AgentMeta
  /**
   * The intent a continuation must keep (#762/#1467): a reopened session keeps its original
   * label, but a continuation's own `intent` event carries the resume message and would relabel
   * the row through {@link applyEventToMeta}'s normal refinement. Unset for a fresh session,
   * where that refinement stands.
   */
  private pinnedIntent: string | undefined

  private constructor(
    private readonly fs: StoreFs,
    readonly dir: string,
    private readonly clock: () => string,
    startMeta: AgentMeta,
  ) {
    this.meta = startMeta
  }

  /** The event log path. */
  get eventsPath(): string {
    return join(this.dir, EVENTS_FILE)
  }

  /** The meta snapshot path. */
  get metaPath(): string {
    return join(this.dir, META_FILE)
  }

  /**
   * Open (creating `.the-framework/` if needed) under the workspace `cwd`. `fresh`
   * truncates any prior log for a new run; the default preserves it so a resume
   * can {@link loadEvents}.
   */
  static async open(cwd: string, opts: OpenStoreOptions = {}): Promise<AgentStore> {
    const fs = opts.fs ?? nodeStoreFs()
    const dir = join(cwd, FRAMEWORK_DIR)
    const now = opts.now ?? new Date().toISOString()
    await fs.mkdir(dir)
    const owner = opts.owner ?? { pid: process.pid, host: hostname() }
    const clock = opts.clock ?? (() => new Date().toISOString())
    const store = new AgentStore(fs, dir, clock, freshMeta(now, opts.intent, owner, opts.id, opts.target, opts.kind))
    if (opts.continueRun) {
      // Reopen: the log stays, the row keeps its original intent, and this process takes ownership
      // so a liveness probe (#716) reads the run as alive rather than as an orphan.
      const prior = await readMetaFile(fs, store.metaPath)
      if (prior) {
        store.meta = { ...prior, status: 'running', pid: owner.pid, host: owner.host, updatedAt: now }
        store.pinnedIntent = prior.intent
        await store.writeMeta()
        return store
      }
    }
    if (opts.fresh) {
      // A new run truncates the live log. First rescue the prior run if it never
      // got archived (e.g. a crash exited before close), so no history is lost.
      await archivePriorRun(fs, dir).catch(() => {})
      await fs.write(store.eventsPath, '')
      await store.writeMeta()
    }
    return store
  }

  /**
   * Append one event to the log and refresh the meta snapshot. Fire-and-forget at
   * the call site: internally chained so writes stay ordered. A failed write is
   * swallowed (persistence is best-effort — it must never break a live run).
   */
  append(event: FrameworkEvent): Promise<void> {
    this.meta = applyEventToMeta(this.meta, event, this.clock())
    // A continuation keeps the session's original label (#762) even though its own `intent`
    // event carries the resume message rather than a name (#1467).
    if (this.pinnedIntent) this.meta = { ...this.meta, intent: this.pinnedIntent }
    this.tail = this.tail
      .then(() => this.fs.append(this.eventsPath, JSON.stringify(event) + '\n'))
      .then(() => this.writeMeta())
      .catch(err => {
        console.error('[framework] failed to persist orchestration state:', err)
      })
    return this.tail
  }

  /**
   * Flush any queued writes, then archive this run into `agents/` so it shows up in
   * the dashboard's history (#303). Both best-effort: persistence must never break
   * a run, so an archive failure is logged, not thrown.
   */
  async close(): Promise<void> {
    await this.tail
    try {
      await archiveRun(this.fs, this.dir, this.meta, this.eventsPath)
    } catch (err) {
      console.error('[framework] failed to archive run history:', err)
    }
  }

  /** The current derived snapshot. */
  snapshot(): AgentMeta {
    return { ...this.meta }
  }

  /**
   * Read and parse the persisted event log. A blank or malformed trailing line
   * (e.g. a crash mid-write) is skipped rather than throwing, so a partial run
   * still replays everything up to the cut. Missing file yields `[]`.
   */
  async loadEvents(): Promise<FrameworkEvent[]> {
    if (!(await this.fs.exists(this.eventsPath))) return []
    return parseEventLog(await this.fs.read(this.eventsPath))
  }

  /** Read the persisted meta snapshot, or `undefined` if none/unreadable. */
  readMeta(): Promise<AgentMeta | undefined> {
    return readMetaFile(this.fs, this.metaPath)
  }

  private writeMeta(): Promise<void> {
    return writeMetaFile(this.fs, this.metaPath, this.meta)
  }
}

/**
 * The directory a run's archive lives in: this user's committed `sessions/` when a caller named
 * one (#1179), else the transient `agents/`. Callers pass a user only where the archive is meant to
 * be kept — the project's copy — never for the copy a run leaves inside its own worktree.
 */
function archiveDir(dir: string, user?: string): string {
  return user ? join(dir, user, ARCHIVE_DIR) : join(dir, AGENTS_DIR)
}

/** Paths of a run's archived log + meta. */
function archivePaths(dir: string, id: string, user?: string): { events: string; meta: string } {
  const agents = archiveDir(dir, user)
  return { events: join(agents, `${id}.jsonl`), meta: join(agents, `${id}.json`) }
}

/**
 * Every directory a project's archived runs may sit in, newest scheme first: each user's
 * `<user>/sessions/`, then the legacy `agents/`.
 *
 * Both are read because both exist in the wild: `agents/` holds everything archived before #1179,
 * and a user directory is only created once that user has run something. Every user's sessions are
 * listed, not just the reader's — the history is a team-visible record of what the agent has done
 * to the repo, which is the point of committing it.
 *
 * A directory is recognized by having a readable `sessions/` child, so a stray file in
 * `.the-framework/` is simply not one (readdir yields `[]` for anything that is not a directory).
 */
/**
 * Where one run's archive actually sits, searched across {@link archiveDirs}, or `undefined` when
 * it is nowhere. A run id alone no longer names a path: which user archived it decides that, and a
 * reader (the continue (#762), a removal) only has the id.
 */
async function findArchive(fs: StoreFs, dir: string, agentId: string): Promise<{ events: string; meta: string } | undefined> {
  for (const agentsDir of await archiveDirs(fs, dir)) {
    const paths = { events: join(agentsDir, `${agentId}.jsonl`), meta: join(agentsDir, `${agentId}.json`) }
    if (await fs.exists(paths.meta)) return paths
  }
  return undefined
}

async function archiveDirs(fs: StoreFs, dir: string): Promise<string[]> {
  const dirs: string[] = []
  for (const name of await fs.readdir(dir)) {
    const candidate = join(dir, name, ARCHIVE_DIR)
    if ((await fs.readdir(candidate)).length > 0) dirs.push(candidate)
  }
  dirs.push(join(dir, AGENTS_DIR))
  return dirs
}

/**
 * Copy a run's live log + meta into its archive as `<id>.jsonl` / `<id>.json`. The live files stay
 * put (the daemon keeps tailing them until the next run); this is a durable snapshot for the
 * history list. Idempotent per id. `user` files it under that user's committed sessions (#1179).
 */
async function archiveRun(fs: StoreFs, dir: string, meta: AgentMeta, eventsPath: string, user?: string): Promise<void> {
  if (!isSafeRunId(meta.id)) return
  await fs.mkdir(archiveDir(dir, user))
  const out = archivePaths(dir, meta.id, user)
  const events = (await fs.exists(eventsPath)) ? await fs.read(eventsPath) : ''
  await fs.write(out.events, events)
  await writeMetaFile(fs, out.meta, meta)
}

/**
 * Archive the run currently sitting in the live files, unless it is already in
 * `agents/`. Used at the start of a fresh run so a crash that skipped
 * {@link AgentStore.close} still leaves its history behind.
 */
async function archivePriorRun(fs: StoreFs, dir: string): Promise<void> {
  const meta = await readMetaFile(fs, join(dir, META_FILE))
  if (!meta?.id || !isSafeRunId(meta.id)) return
  if (await fs.exists(archivePaths(dir, meta.id).meta)) return
  await archiveRun(fs, dir, meta, join(dir, EVENTS_FILE))
}

/**
 * Put an archived run's history back where a run reads it (#762), so a continued run picks up its
 * own log rather than starting empty. The inverse of {@link archiveWorktreeAgent}: teardown moved the
 * history to the repo, and continuing needs it in the checkout again.
 *
 * A no-op when the worktree already holds a live run (nothing to restore, and its log is newer),
 * or when there is no archive. Never throws.
 */
export async function restoreArchivedAgent(
  repo: string,
  worktree: string,
  agentId: string,
  fs: StoreFs = nodeStoreFs(),
): Promise<boolean> {
  try {
    if (!isSafeRunId(agentId)) return false
    const dir = join(worktree, FRAMEWORK_DIR)
    if (await fs.exists(join(dir, META_FILE))) return false
    const archive = await findArchive(fs, join(repo, FRAMEWORK_DIR), agentId)
    if (!archive) return false
    await fs.mkdir(dir)
    await fs.write(join(dir, EVENTS_FILE), (await fs.exists(archive.events)) ? await fs.read(archive.events) : '')
    await fs.write(join(dir, META_FILE), await fs.read(archive.meta))
    return true
  } catch {
    return false
  }
}

/**
 * The run ids that have a worktree directory under `.the-framework/worktrees/` (#737). Names
 * only, from the filesystem: a directory here IS a run's checkout, and its name is the run id.
 * Forgiving — a project that never ran concurrently has no such dir and yields `[]`.
 */
export async function listWorktreeDirs(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<string[]> {
  const names = await fs.readdir(join(cwd, FRAMEWORK_DIR, WORKTREES_DIR)).catch(() => [])
  return names.filter(isSafeRunId)
}

/**
 * Archive a worktree run's history into the *main repo* (#737), returning the meta it archived.
 *
 * A run writes its `agent.json` / `events.jsonl` inside its own worktree (#736), so deleting that
 * worktree would delete the run's history with it. This copies it into the repo, which is the one
 * place the dashboard's history reads from, so teardown becomes safe.
 *
 * `user` files the copy under that user's committed `sessions/` (#1179) instead of the transient
 * `agents/`. It is this copy, not the one the run left in its own worktree, that is meant to last:
 * every run in a git repo gets a worktree, so this is the only archive of it that outlives the
 * checkout, and committing it is what makes the history survive `git clean -fdx`. The worktree's
 * own copy deliberately stays untracked — it would otherwise be committed onto the run's branch as
 * well and collide with this one on merge.
 *
 * A meta still marked `running` is flipped to `stopped` first: this runs when the process is
 * already gone, so `running` means it died without closing (crash, kill -9), exactly the case
 * {@link reconcileOrphanedAgents} handles for the project path. Idempotent per id, and forgiving:
 * a worktree with no run, or an unreadable one, yields `undefined` rather than throwing.
 */
export async function archiveWorktreeAgent(
  worktree: string,
  repo: string,
  fs: StoreFs = nodeStoreFs(),
  branch?: string,
  user?: string,
): Promise<AgentMeta | undefined> {
  try {
    const worktreeDir = join(worktree, FRAMEWORK_DIR)
    const live = await readMetaFile(fs, join(worktreeDir, META_FILE))
    if (!live?.id || !isSafeRunId(live.id)) return undefined
    // The flip writes the worktree's own log + meta too (#1359): the death gains its `end`
    // event before the archive copies the log, so no reader — live tail or archived replay —
    // is left holding an open gate for a dead run.
    const stopped: AgentMeta = live.status === 'running' ? await recordOrphanEnd(fs, worktreeDir, live) : live
    // The branch is read from the checkout by the caller and stamped here, because this is the
    // last moment it can be observed: the worktree is about to go (#799).
    const meta: AgentMeta = branch ? { ...stopped, branch } : stopped
    await archiveRun(fs, join(repo, FRAMEWORK_DIR), meta, join(worktreeDir, EVENTS_FILE), user)
    return meta
  } catch {
    return undefined
  }
}

/**
 * The archived log + meta paths of one run, wherever it is filed, or `[]` when it is nowhere.
 * Exported so a caller that deletes a session (the dashboard's Remove) does not have to know which
 * user archived it — before #1179 the path was derivable from the id alone, and now it is not.
 */
export async function archivedAgentPaths(cwd: string, agentId: string, fs: StoreFs = nodeStoreFs()): Promise<string[]> {
  if (!isSafeRunId(agentId)) return []
  const archive = await findArchive(fs, join(cwd, FRAMEWORK_DIR), agentId).catch(() => undefined)
  return archive ? [archive.meta, archive.events] : []
}

/** Newest run first: an id sorts chronologically, so the id order IS the time order (no parse). */
const byIdDesc = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

/**
 * Every `runs/*.json` archived meta with the path it was read from, torn/half-written entries
 * skipped. The one home of the archived-history read loop, shared by {@link listAgents} and the
 * boot reconcile. A missing/unreadable dir throws to the caller, as both callers always let it.
 */
async function readArchivedMetaEntries(fs: StoreFs, agentsDir: string): Promise<Array<{ path: string; meta: AgentMeta }>> {
  const entries: Array<{ path: string; meta: AgentMeta }> = []
  for (const name of await fs.readdir(agentsDir)) {
    if (!name.endsWith('.json')) continue
    const path = join(agentsDir, name)
    try {
      entries.push({ path, meta: JSON.parse(await fs.read(path)) as AgentMeta })
    } catch {
      // torn/half-written meta — skip it
    }
  }
  return entries
}

/**
 * A `running` meta whose owning process is provably gone (or unknowable on boot): the orphan
 * {@link reconcileOrphanedAgents} flips to `stopped`. A live pid on this host, or a non-running
 * meta, is left be. The narrowing lets a caller use the meta as present in the true branch.
 */
function isDeadRunning(meta: AgentMeta | undefined, isAlive: (pid: number) => boolean): meta is AgentMeta {
  return meta?.status === 'running' && ownerLiveness(meta, isAlive) !== 'live'
}

/**
 * Every archived meta a project has, across all of {@link archiveDirs}, with the path it came from.
 * De-duplicated by run id, first directory winning: a run archived before #1179 and re-archived
 * into its user's sessions afterwards exists in both places, and the history must show it once.
 * The user directories are searched before `agents/`, so the committed copy is the one that wins.
 */
async function readAllArchivedMetaEntries(fs: StoreFs, dir: string): Promise<Array<{ path: string; meta: AgentMeta }>> {
  const seen = new Set<string>()
  const entries: Array<{ path: string; meta: AgentMeta }> = []
  for (const agentsDir of await archiveDirs(fs, dir)) {
    for (const entry of await readArchivedMetaEntries(fs, agentsDir).catch(() => [])) {
      if (seen.has(entry.meta.id)) continue
      seen.add(entry.meta.id)
      entries.push(entry)
    }
  }
  return entries
}

/**
 * List a project's archived runs, most-recent first: every user's committed `sessions/` plus the
 * legacy `agents/`. The id sorts chronologically so no timestamp parse is needed. Missing or
 * unreadable dir/entries are skipped, never thrown.
 */
export async function listAgents(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<AgentMeta[]> {
  const entries = await readAllArchivedMetaEntries(fs, join(cwd, FRAMEWORK_DIR))
  return entries.map(entry => entry.meta).sort(byIdDesc)
}

/**
 * Whether a `running` meta's owning process is provably there, provably gone, or unknowable.
 *
 * `'unknown'` is the load-bearing third state (#716/#926): a meta with no `pid` (it predates the
 * field) or one owned by another host cannot be probed from here. The two callers treat it
 * differently on purpose — the boot reconcile flips an unknown to `stopped` (a fresh daemon
 * drives no in-flight run, and there is nothing better to go on), while the self-heal on read
 * leaves it alone (a routine read must not kill a run another machine may own).
 */
function ownerLiveness(meta: AgentMeta, isAlive: (pid: number) => boolean): 'live' | 'dead' | 'unknown' {
  if (meta.status !== 'running' || meta.pid === undefined || meta.host !== hostname()) return 'unknown'
  return isAlive(meta.pid) ? 'live' : 'dead'
}

/**
 * Reconcile runs a dead process left marked `running` — the live `agent.json`, an archived
 * `runs/*.json`, or a run inside a worktree. Such a run shows as active while nothing is left
 * to read its `control.jsonl`, so its Stop is a no-op. Each is flipped to `stopped`; the live
 * run is archived first (idempotent) so its history is kept. Returns how many were reconciled.
 * Best-effort: a read/write error skips that run, never throws.
 *
 * A run whose pid is alive on this host is left alone (#926). This used to flip every `running`
 * meta on the assumption that a fresh dashboard drives no in-flight run, which holds only while
 * exactly one is ever booted: a second one marked genuinely live runs as finished, giving them a
 * no-op Stop in the dashboard. A meta with no `pid` keeps the old behaviour, since there is
 * nothing better to go on.
 */
export async function reconcileOrphanedAgents(
  cwd: string,
  fs: StoreFs = nodeStoreFs(),
  isAlive: (pid: number) => boolean = isPidAlive,
): Promise<number> {
  const dir = join(cwd, FRAMEWORK_DIR)
  let fixed = 0
  // Archived runs stuck at `running` (e.g. a prior live run the next run never rescued), wherever
  // they are archived. Done before the live run so its fresh archive isn't re-counted here.
  for (const { path, meta } of await readAllArchivedMetaEntries(fs, dir)) {
    if (!isDeadRunning(meta, isAlive)) continue
    try {
      // The archived pair sits side by side (`<id>.json` + `<id>.jsonl`), so the surrogate end
      // (#1359) lands in both: the replayed log sees the run finish, and the meta fold drops
      // the pendingChoice the run died holding.
      const event = orphanEndEvent()
      await fs.append(path.replace(/\.json$/, '.jsonl'), JSON.stringify(event) + '\n').catch(() => {})
      await writeMetaFile(fs, path, applyEventToMeta(meta, event, new Date().toISOString()))
      fixed++
    } catch {
      // write failed — best-effort, skip
    }
  }
  // The live run: flip it, then archive so a crash that skipped close() still
  // leaves the stopped run in the history list.
  const live = await readMetaFile(fs, join(dir, META_FILE))
  if (isDeadRunning(live, isAlive)) {
    await stopAndArchiveLive(fs, dir, live)
    fixed++
  }

  // Runs living in worktrees (#736/#737). A daemon that died mid-run never ran its teardown, so
  // each of those runs is orphaned the same way — except its history sits inside the worktree,
  // where nothing reads it. Flip it in place (so the dashboard stops showing it as live) and copy
  // it into the repo's history. The worktree itself is left on disk: a run that ended this way did
  // not end cleanly, and those are kept for inspection. Removing one is an explicit action.
  for (const name of await fs.readdir(join(dir, WORKTREES_DIR))) {
    if (!isSafeRunId(name)) continue
    const worktreeDir = join(dir, WORKTREES_DIR, name, FRAMEWORK_DIR)
    const meta = await readMetaFile(fs, join(worktreeDir, META_FILE))
    if (!isDeadRunning(meta, isAlive)) continue
    // recordOrphanEnd rather than a bare status flip (#1359): the worktree's log gains the
    // `end` event first, so the archive below copies a stream that actually ends.
    await recordOrphanEnd(fs, worktreeDir, meta)
    await archiveWorktreeAgent(join(dir, WORKTREES_DIR, name), cwd, fs).catch(() => undefined)
    fixed++
  }
  return fixed
}

/**
 * Whether `pid` is a live process on this host. `process.kill(pid, 0)` sends no signal but
 * throws `ESRCH` once the process is gone; `EPERM` means it exists under another user (still
 * alive). A pid on a *different* host is unknowable here, so callers guard on {@link AgentMeta.host}
 * before trusting a result. A recycled pid (another process reusing a dead run's number) reads as
 * alive — an accepted, vanishingly rare miss on a single dev box.
 */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * The live (in-progress) run's meta snapshot from `.the-framework/agent.json`, or
 * `undefined` when none/unreadable. Unlike {@link listAgents} (which reads the
 * archived `agents/` copies written on close), this is the run the daemon is
 * tailing right now — so the dashboard can list it with a `running` status
 * before it finishes. Missing or torn file yields `undefined`, never throws.
 *
 * Self-heals a stale run on read (#716): if the meta says `running` but its owning process died
 * without writing `end` (a crash, `kill -9`, or the machine sleeping), nothing is left to consume
 * `control.jsonl` — so Stop is a no-op and the row is stuck. When the owning pid is gone on this
 * host, flip it to `stopped` and archive it, so the dashboard clears the row on the next poll
 * instead of only after a daemon restart's boot-time {@link reconcileOrphanedAgents}. A run whose
 * meta predates this field (no `pid`) is left untouched — the boot reconcile still catches it.
 */
export async function readLiveMeta(
  cwd: string,
  fs: StoreFs = nodeStoreFs(),
  isAlive: (pid: number) => boolean = isPidAlive,
): Promise<AgentMeta | undefined> {
  const dir = join(cwd, FRAMEWORK_DIR)
  const meta = await readMetaFile(fs, join(dir, META_FILE))
  if (!meta) return undefined
  // Only a provably dead owner heals here — 'unknown' (no pid / another host) is left alone.
  if (ownerLiveness(meta, isAlive) === 'dead') return stopAndArchiveLive(fs, dir, meta)
  return meta
}

/**
 * A live run plus the checkout it is running in (#738). Since #736 a run lives in its own
 * worktree, so a project's live run is no longer a single thing and no longer sits at the
 * project path: `cwd` says which checkout to read that run's git/file status from.
 */
export interface LiveAgent extends AgentMeta {
  /** The run's own checkout: a worktree under `.the-framework/worktrees/`, or the repo root. */
  cwd: string
}

/**
 * Every live run of a project (#738): the list variant of {@link readLiveMeta}.
 *
 * A run started from the dashboard gets its own worktree (#736) and writes its `agent.json`
 * inside it, so the project path alone no longer sees any of them. This looks in both places:
 * each `.the-framework/worktrees/*` checkout, and the repo root itself, which is where a
 * project that cannot be given a worktree (not a git repo) still runs and where every run
 * from before #736 lives.
 *
 * Each candidate goes through {@link readLiveMeta}, so a stale run self-heals exactly as it
 * did. Newest first, by id. Never throws: an unreadable worktree is skipped.
 */
export async function readLiveMetas(
  cwd: string,
  fs: StoreFs = nodeStoreFs(),
  isAlive: (pid: number) => boolean = isPidAlive,
): Promise<LiveAgent[]> {
  const worktreesDir = join(cwd, FRAMEWORK_DIR, WORKTREES_DIR)
  const names = await fs.readdir(worktreesDir).catch(() => [])
  // isSafeRunId: the directory name is the run id, and anything else in there is not ours.
  const candidates = [cwd, ...names.filter(isSafeRunId).map(name => join(worktreesDir, name))]
  const agents: LiveAgent[] = []
  for (const candidate of candidates) {
    const meta = await readLiveMeta(candidate, fs, isAlive).catch(() => undefined)
    if (meta) agents.push({ ...meta, cwd: candidate })
  }
  return agents.sort(byIdDesc)
}

/**
 * Read one archived run's event log for replay. Returns `undefined` for an
 * unknown or unsafe id; a torn trailing line is dropped (same rule as the live
 * {@link AgentStore.loadEvents}).
 */
export async function loadRunEvents(
  cwd: string,
  id: string,
  fs: StoreFs = nodeStoreFs(),
): Promise<FrameworkEvent[] | undefined> {
  if (!isSafeRunId(id)) return undefined
  const archive = await findArchive(fs, join(cwd, FRAMEWORK_DIR), id)
  if (!archive || !(await fs.exists(archive.events))) return undefined
  return parseEventLog(await fs.read(archive.events))
}

/** A {@link StoreFs} backed by `node:fs/promises`. See {@link nodeFs}. */
export function nodeStoreFs(): StoreFs {
  // Destructured rather than returned whole: the narrow interface is the contract,
  // so the object should not carry methods the store was never handed.
  const { read, write, append, exists, mkdir, readdir, rename } = nodeFs()
  return { read, write, append, exists, mkdir, readdir, rename }
}

/**
 * A project's runs: the live ones prepended to the archived history, newest-first. Forgiving —
 * a side that cannot be read simply contributes nothing.
 *
 * Live wins over archived (#768). The dedup used to drop the live copy, which was right while
 * "archived" meant "finished for good": a run was only ever copied into `agents/` on its way out.
 * Continuing a run (#762) breaks that — the run has an archived copy from its first leg AND is
 * live again — and keeping the archive showed a running run as finished.
 *
 * This composition, not its two halves, is what every caller actually wants; the store exporting
 * only the halves is why three separate modules each grew their own copy of it.
 */
export async function readAllAgents(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<AgentMeta[]> {
  const [archived, live] = await Promise.all([
    listAgents(cwd, fs).catch(() => [] as AgentMeta[]),
    readLiveMetas(cwd, fs).catch(() => [] as LiveAgent[]),
  ])
  return [...live, ...archived.filter(agent => !live.some(l => l.id === agent.id))]
}

/**
 * One run's meta by id, live copy winning over archived — {@link readAllAgents}'s rule for a
 * single row. The find-by-id shape the RPCs kept privately rebuilding, for the same reason
 * the list shape did: the store exported only the halves.
 */
export async function findAgent(cwd: string, agentId: string, fs: StoreFs = nodeStoreFs()): Promise<AgentMeta | undefined> {
  return (await readAllAgents(cwd, fs)).find(agent => agent.id === agentId)
}

/**
 * Read a checkout's live event log (`.the-framework/events.jsonl`). Missing or unreadable
 * yields `[]`, and a torn trailing line is dropped — the same rule as
 * {@link AgentStore.loadEvents}, exported so a reader outside the store (the Discord bot's gate
 * lookup) cannot keep a second parser with a drifted torn-line policy.
 */
export async function readEventLog(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<FrameworkEvent[]> {
  const path = join(cwd, FRAMEWORK_DIR, EVENTS_FILE)
  try {
    if (!(await fs.exists(path))) return []
    return parseEventLog(await fs.read(path))
  } catch {
    return []
  }
}

/**
 * Record the pull request a finished run's work is on (E6).
 *
 * A PR opened by the dashboard's button happens *after* the run's process is gone, so there is no
 * event stream left to carry it — but the fact is exactly as worth recording as the one the run
 * emits for itself, and every surface reads it from the same place either way. So the archived meta
 * is patched in place.
 *
 * Best-effort and idempotent: a run with no archive yet, an unreadable meta, or a failed write
 * simply leaves the record as it was. The cost of missing it is one surface having to ask `gh`,
 * which is what all of them used to do.
 */
export async function recordRunPr(
  cwd: string,
  agentId: string,
  pr: { number: number; url: string },
  fs: StoreFs = nodeStoreFs(),
): Promise<boolean> {
  if (!isSafeRunId(agentId)) return false
  try {
    const archive = await findArchive(fs, join(cwd, FRAMEWORK_DIR), agentId)
    if (!archive) return false
    const meta = await readMetaFile(fs, archive.meta)
    if (!meta) return false
    await fs.write(archive.meta, JSON.stringify({ ...meta, pr }))
    return true
  } catch {
    return false
  }
}
