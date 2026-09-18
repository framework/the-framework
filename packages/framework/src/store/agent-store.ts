import { join } from 'node:path'
import type { AutoHandoffSkip, FrameworkEvent } from '../events.js'
import { nodeFs } from '../node-fs.js'
import { agentBranchName, isSafeAgentId, worktreeDirEntries } from '@gemstack/skill-branches'
import { THE_FRAMEWORK_DIR } from '../framework-dir.js'
import { listRuns, parseRunCard, readDiary, runFiles, type AnyDiaryLine, type LogsDeps } from '@gemstack/skill-logs'
import { eventsOf, fromRunCard } from './run-record.js'

/**
 * The read side of a project's runs (#1774). The daemon runs no agent and writes no run: a run's
 * tool keeps the run's card (`<id>.json`) and diary (`<id>.jsonl`) under the `.the-framework/`
 * of the run's own checkout while it works, and the `logs` skill's copy of both on the data
 * branch is the one place a finished run lives. The dashboard is a projection of those files.
 */

export type AgentStatus = 'running' | 'done' | 'stopped' | 'failed' | 'waiting'

/**
 * A queryable snapshot of the agent, derived entirely from the event log. Lets the
 * dashboard render a header (and a future agent list) without parsing every line.
 */
export interface AgentMeta {
  status: AgentStatus
  /** Stable, path-safe id for this agent (derived from {@link startedAt}). */
  id: string
  /** ISO timestamp the store was opened (run start). */
  startedAt: string
  /** ISO timestamp of the last event written. */
  updatedAt: string
  /** ISO timestamp the run ended (the `end` event), absent while it is going. The skill's card field. */
  endedAt?: string
  /** What the run cost so far in US dollars, summed over its `usage` events; absent until one says. The skill's card field. */
  cost?: number
  /**
   * The OS pid of the process running this run, on {@link host} — whatever process the project's
   * start hook began. Recorded on the card so Stop has something to signal, and so a reader can
   * tell a run that is working from one whose process died without recording an ending (#716).
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
  /**
   * The branch the agent's work is on: folded from `branch` events as the agent observes it (#1277),
   * and corrected at teardown while the worktree still exists (#799). The session name is this
   * branch minus its prefix (#1725) — read off it by every surface, never stored beside it.
   *
   * Not reliably derivable instead of recorded: a clean agent loses its checkout, and the agent
   * renames its branch itself (#1725), so the run-id branch is not guaranteed to be the one
   * holding the commits.
   */
  branch?: string
  /**
   * The hand-off anchor a cloud run pushed for its session to clone at (#1601): an empty commit
   * unique to this run, folded from the `cloud-anchor` event. The session works on a `claude/*`
   * branch of the cloud's own naming, and this is the ancestor by which the daemon's adoption
   * pass recognizes which of origin's `claude/*` heads is this run's. Absent on non-web runs
   * and on web runs whose pre-hand-off push failed.
   */
  cloudAnchor?: string
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
   * On the meta because the checkboxes that show it live in a different process from the agent that
   * obeys it, and a tab opened after the agent started has no event history to fold — the same
   * reason {@link browserStreamPort} is here. Absent means an older agent, which the reader treats
   * as armed, matching what that agent will actually do.
   *
   * `merge` mirrors the auto-merge arming (#1216, #1382) — display-only, like the rest of this
   * field: the agent merges off its own config, never off the meta. Absent on records from before
   * #1382, which the reader treats as off.
   */
  handoff?: { push: boolean; pr: boolean; merge?: boolean }
  /**
   * How the end-of-session handoff reported back (#1455), folded from the `handoff` event.
   *
   * What lets a list surface — which reads meta, not the event log — tell "ended, still
   * publishing" from "ended, published": between a clean `end` and this field, an armed agent's
   * epilogue is still pushing / opening the PR, exactly the window the session pill calls
   * "publishing…" (#1431). Absent until the event lands, which is what a list reads as "still going".
   */
  handoffReport?: 'done' | 'skipped' | 'failed'
  /**
   * Why a skipped handoff skipped (#1583), folded from the same `handoff` event as
   * {@link handoffReport}. What lets the daemon tell "published elsewhere" from "ended with
   * nothing to hand off": a drain that settles with `no-commits` will never run the PR that
   * lifts its ticket lock, so the sweep releases the claim it minted. On the meta because the
   * sweep reads metas, not event logs. Absent on non-skipped handoffs and on older records.
   */
  handoffSkip?: AutoHandoffSkip
  /**
   * How the handoff's merge half went (#1418), folded from the `handoff` event's `merge` field.
   *
   * What the daemon's CI watch scans for: `watched` is a PR waiting for green that *this* side
   * must merge (the repo could not arm GitHub auto-merge), `auto-armed` one GitHub will land by
   * itself but whose checks going red is still ours to notice. On the meta because the watch
   * reads metas, not event logs, and must survive both the agent's process and the daemon's.
   * Absent on runs from before this field, and on every agent whose handoff had no merge to report.
   */
  mergeOutcome?: 'auto-armed' | 'merged' | 'watched' | 'withheld' | 'failed'
  /**
   * The choice gate the agent is currently parked on (#636): set when a `choice` event fires and
   * cleared when its `choice-resolved` (or the agent's `end`) arrives. Present means the agent is
   * paused waiting for the user's answer — the second "needs you" source after open PRs (#624).
   */
  pendingChoice?: { id: string; title: string }
  /**
   * When the agent settled and parked on the user (#785), or absent while the agent is working.
   *
   * Deliberately not a {@link AgentStatus} value: the agent IS still live while it waits (its
   * process is alive, it still takes messages, it still holds the project), and a dozen readers
   * key "live" off `status === 'running'`. This is the orthogonal fact — working, or waiting on
   * you — which `status` cannot carry because it only changes when the agent ends.
   */
  settledAt?: string
  /**
   * The browser bridge holds a question this run's cloud session is parked on (#1668). Not stored:
   * the daemon annotates a web run's record on the way to the dashboard, the way a relayed run's
   * label is, because the bridge store is in memory and the archive on disk knows nothing of it.
   */
  cloudWaiting?: boolean
  /**
   * The run was started by another machine's daemon (#1648): its {@link host} is not this one.
   * Not stored either — annotated on the way to the dashboard like {@link cloudWaiting}, since
   * the shared data branch shows every machine's runs here and only this daemon knows which host
   * it is.
   */
  otherHost?: boolean
  /**
   * The loopback port the agent's browser preview is listening on (#813), or absent when the agent
   * has no browser. What lets the daemon proxy the pane: the port is allocated per agent and the
   * dashboard is a different process, so meta is the only place it can learn it.
   */
  browserStreamPort?: number
  /**
   * Where this run executes (#1050/#1053/#610): `actions` for a GitHub Actions run, `web` for a
   * Claude Code cloud session, `remote` when relayed to a connected device (#1067), absent for a
   * local run. Persisted so the agent view can tell a burst-mode Actions run from a stalled live
   * feed, show a cloud agent's session link after a reload, and gate the browser pane off (#1053).
   */
  target?: 'local' | 'actions' | 'remote' | 'web'
  /** The connected device a remote agent (#1067) executes on, for the session list + notice after a reload. */
  remoteLabel?: string
  /**
   * The flow this agent started under (#1467): `build` for the scope→build orchestration, `prompt`
   * for the direct-prompt path (research and transparent runs record `prompt` too). Persisted so a
   * continuation (#762) can re-enter the flow its first leg ran — the composer's Resume always
   * arrives as a `prompt` start, and without this record a resumed build agent ended as a bare
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
 * The slice of a filesystem the store's reads need: the logic is testable with an in-memory fs,
 * and only {@link nodeStoreFs} touches disk.
 */
export interface StoreFs {
  read(path: string): Promise<string>
  write(path: string, contents: string): Promise<void>
  append(path: string, contents: string): Promise<void>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  /** List a directory's entries (names only). Missing dir yields `[]`. */
  readdir(path: string): Promise<string[]>
  /** The names of the *directories* under `path` — a symlink is not one. Missing dir yields `[]`. */
  subdirs(path: string): Promise<string[]>
}

/** The `logs` skill's file seam over a {@link StoreFs}. */
function runDeps(fs: StoreFs): LogsDeps {
  return {
    read: path => fs.read(path),
    list: path => fs.readdir(path),
    write: async (path, content) => {
      await fs.mkdir(join(path, '..'))
      await fs.write(path, content)
    },
  }
}

/**
 * The card + diary paths of one finished run on the data branch's checkout, or `[]` when the
 * branch has no such run. For a caller that needs the file itself: the tail of an ended run.
 */
export async function archivedAgentPaths(cwd: string, agentId: string, fs: StoreFs = nodeStoreFs()): Promise<string[]> {
  if (!isSafeAgentId(agentId)) return []
  const files = await runFiles(cwd, agentId, runDeps(fs)).catch(() => undefined)
  return files ? [files.card, files.diary] : []
}

/** Newest run first: an id sorts chronologically, so the id order IS the time order (no parse). */
const byIdDesc = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

/**
 * A project's recorded runs, most-recent first: the runs on the data branch (every person's),
 * read through the `logs` skill and unfolded into the framework's meta. An unreadable branch is
 * no runs, never a throw.
 *
 * `since` (epoch ms) is for a caller that only wants recent runs — a poll on a cadence, not the
 * history list.
 */
export async function listAgents(cwd: string, fs: StoreFs = nodeStoreFs(), since?: number): Promise<AgentMeta[]> {
  const runs = await listRuns(cwd, since === undefined ? {} : { since }, runDeps(fs)).catch((): never[] => [])
  return runs.map(fromRunCard).sort(byIdDesc)
}

/**
 * Whether `pid` is a live process on this host. `process.kill(pid, 0)` sends no signal but
 * throws `ESRCH` once the process is gone; `EPERM` means it exists under another user (still
 * alive). A pid on a *different* host is unknowable here, so callers guard on {@link AgentMeta.host}
 * before trusting a result. A recycled pid (another process reusing a dead agent's number) reads as
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

/** The id of the run a checkout is for: the directory is `agent-<id>`. The project root is no run's. */
function checkoutAgentId(cwd: string): string | undefined {
  const name = cwd.split('/').pop() ?? ''
  const prefix = agentBranchName('')
  return name.startsWith(prefix) ? name.slice(prefix.length) : undefined
}

/**
 * The run a checkout holds, off its live card, `<id>.json` under the checkout's `.the-framework/`:
 * the shape agent-driver's log writes, read as the meta the card unfolds to, `running` or not (a
 * run that ended waiting on a question keeps its checkout). `undefined` when there is none.
 * Never healed here: the tool that started the run sweeps its own dead runs.
 */
export async function readLiveMeta(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<AgentMeta | undefined> {
  const id = checkoutAgentId(cwd)
  if (id === undefined) return undefined
  const path = join(cwd, THE_FRAMEWORK_DIR, `${id}.json`)
  if (!(await fs.exists(path))) return undefined
  const card = parseRunCard(await fs.read(path).catch(() => ''))
  return card ? fromRunCard(card) : undefined
}

/** A run with a checkout, plus that checkout (#738): where to read the run's git and file status from. */
export interface LiveAgent extends AgentMeta {
  /** The run's own checkout, a worktree under `.branches/`. */
  cwd: string
}

/**
 * Every run of a project that has a checkout (#738): each `.branches/*` checkout's card, through
 * {@link readLiveMeta}. Newest first, by id. Never throws: an unreadable checkout is skipped.
 */
export async function readLiveMetas(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<LiveAgent[]> {
  // The checkouts under `.branches/`: the agent-branch-named directories, never the rename links beside them.
  const candidates = (await worktreeDirEntries(cwd, path => fs.subdirs(path))).map(entry => entry.path)
  const agents: LiveAgent[] = []
  for (const candidate of candidates) {
    const meta = await readLiveMeta(candidate, fs).catch(() => undefined)
    if (meta) agents.push({ ...meta, cwd: candidate })
  }
  return agents.sort(byIdDesc)
}

/** A diary file's lines; a torn trailing line from a write in flight is dropped. */
function parseDiary(raw: string): AnyDiaryLine[] {
  const lines: AnyDiaryLine[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      lines.push(JSON.parse(trimmed) as AnyDiaryLine)
    } catch {
      break
    }
  }
  return lines
}

/**
 * One run's events, for a reader that replays them: the diary in the run's checkout while it has
 * one (it is the newer of the two), else the run's diary on the data branch. `undefined` for an
 * unknown or unsafe id.
 */
export async function loadAgentEvents(cwd: string, id: string, fs: StoreFs = nodeStoreFs()): Promise<FrameworkEvent[] | undefined> {
  if (!isSafeAgentId(id)) return undefined
  const live = (await readLiveMetas(cwd, fs).catch((): LiveAgent[] => [])).find(agent => agent.id === id)
  const liveDiary = live ? join(live.cwd, THE_FRAMEWORK_DIR, `${id}.jsonl`) : undefined
  if (liveDiary && (await fs.exists(liveDiary))) return eventsOf(parseDiary(await fs.read(liveDiary).catch(() => '')))
  const diary = await readDiary(cwd, id, runDeps(fs)).catch(() => undefined)
  return diary ? eventsOf(diary) : undefined
}

/** A {@link StoreFs} backed by `node:fs/promises`. See {@link nodeFs}. */
export function nodeStoreFs(): StoreFs {
  // Destructured rather than returned whole: the narrow interface is the contract,
  // so the object should not carry methods the store was never handed.
  const { read, write, append, exists, mkdir, readdir, subdirs } = nodeFs()
  return { read, write, append, exists, mkdir, readdir, subdirs }
}

/**
 * A project's runs: the ones with a checkout prepended to the recorded history, newest-first.
 * Forgiving — a side that cannot be read simply contributes nothing.
 *
 * The checkout's card wins over the recorded one (#768): a resumed run has a record from its
 * first leg AND is going again, and the record alone would show a running agent as finished.
 */
export async function readAllAgents(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<AgentMeta[]> {
  const [archived, live] = await Promise.all([
    listAgents(cwd, fs).catch(() => [] as AgentMeta[]),
    readLiveMetas(cwd, fs).catch(() => [] as LiveAgent[]),
  ])
  return [...live, ...archived.filter(agent => !live.some(l => l.id === agent.id))]
}

/** One run's meta by id, the checkout's card winning over the record: {@link readAllAgents}'s rule for a single row. */
export async function findAgent(cwd: string, agentId: string, fs: StoreFs = nodeStoreFs()): Promise<AgentMeta | undefined> {
  return (await readAllAgents(cwd, fs)).find(agent => agent.id === agentId)
}
