import { isAgentLocation, type AgentLocation } from './agent-location.js'
import { isHandoffLevel, type HandoffLevel } from './handoff-level.js'
import { basename, dirname, join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { isDriverName } from './driver-names.js'
import { nodeFs } from './node-fs.js'
import { MAX_SPEND_OFFSET, DEFAULT_SPEND_OFFSET } from './preference-defaults.js'

/**
 * The multi-project registry (#390): the list of projects the user has
 * installed The Framework into, kept as a single JSON file `.bashrc`-style —
 * `$HOME/.the-framework.json` — so it is the user's responsibility to re-create
 * per machine. The same file also holds the user's dashboard preferences (#410),
 * so the daemon owns one user file and the UI never needs localStorage.
 */

/** One registered project. */
export interface ProjectRecord {
  /** Stable, URL-safe id derived from the path. */
  id: string
  /** Absolute repo path. */
  path: string
  /** ISO timestamp the project was added. */
  addedAt: string
}

/**
 * The dashboard's Global options (#410), persisted next to the project list so they
 * survive restarts without localStorage — the daemon reads/writes them, the SPA reads
 * them over `POST /_rpc/onPreferences`. Mostly flat booleans mirroring the Start form's
 * toggles; every field is optional and absent means off, except where a field documents its
 * own default below.
 */

/**
 * A user-defined preset (#626): a named prompt the user saved to re-run their own high-signal
 * prompts, sitting beside the built-in presets in the Start form. Just data — the label is the
 * button, the prompt is loaded verbatim into the editor and run as a `prompt` kind (unlike the
 * built-ins, whose text is a compiled render function). `id` is stable so edits/deletes address one.
 */
export interface CustomPreset {
  id: string
  label: string
  prompt: string
}

/** The cap on saved custom presets, and the per-field lengths — enough for real prompts, bounded
 * so a hand-edited or hostile registry can't bloat the home file. */
const CUSTOM_PRESET_LIMITS = { count: 30, label: 80, prompt: 20_000 } as const

export interface Preferences {
  vanilla?: boolean
  /** On-before-mergeable prompt (#326): on setReadyForMerge(), queue the quality follow-ups as TODO entries. */
  onBeforeMergeableQuality?: boolean
  /** Give the agent a real browser via chrome-devtools-mcp during the agent (#452); maps to `--browser`. */
  browser?: boolean
  /**
   * How far a finished session publishes itself (#1102/#1216/B5): keep it local, push the branch,
   * open a draft PR, or merge that PR. Absent = {@link DEFAULT_HANDOFF} (`pr`).
   *
   * Default-on, unlike most of this file, because it is what makes the handoff zero-config: the
   * old behaviour was a button nobody was obliged to press, and work that stayed on a local
   * branch nobody was told about (#860). A session can still opt out from its action bar.
   */
  handoff?: HandoffLevel
  /**
   * Transparent mode (#625): run the wrapped agent raw — no framework system prompt, emit
   * protocols, consumption guard, dashboard, or TODO loop, so an agent is identical to `claude -p`.
   * The coarse master off-switch ("only pick what you need"); maps to `--transparent`. Absent = off.
   */
  transparent?: boolean
  /** Fire a browser notification when a new item lands on the "needs you" queue (#627). Absent = on. */
  notifyBrowser?: boolean
  /**
   * Also notify on plain agent activity — an agent started, an agent finished (#627). The default-off
   * counterpart to the always-on "needs you" notifications: it keeps you loosely informed of the
   * pipeline moving even when nothing needs you. A *category* toggle: it composes with the method
   * toggles ({@link notifyBrowser} / {@link notifyDiscord}), so activity reaches whichever are on.
   */
  notifyNewActivity?: boolean
  /**
   * The "needs you" category (#627): notify when an agent is awaiting your answer or a PR is ready
   * to review. A *category* toggle, like {@link notifyNewActivity}, composing with the method
   * toggles ({@link notifyBrowser} / {@link notifyDiscord}). **Absent = on**: unlike the other
   * flat opt-in booleans, human-intervention pings are the baseline The Framework leans on, so an
   * unset preference keeps them firing; a user turns them off explicitly.
   */
  notifyHumanIntervention?: boolean
  /** The model to run on (#628), e.g. `opus` / `sonnet`; maps to an agent's `--model`. Absent = the driver's default. */
  model?: string
  /** Which coding agent drives the agent (#650): `claude` or `codex`; maps to `--agent`. Absent = the default (`claude`). */
  driver?: string
  /** Preferred editor for "Open in editor" (#727): an editor CLI (e.g. `code`, `cursor`, `zed`).
   * Absent falls back to `$FRAMEWORK_EDITOR`, then `code`. */
  editor?: string
  /** Dashboard color theme (#725): `system` (follow the OS, the default), `light`, or `dark`. Absent = system. */
  theme?: 'system' | 'light' | 'dark'
  /** Where a run executes (#1050/#610): `local` (this device, the default), `actions` (a fresh GitHub Actions runner) or `web` (a Claude Code cloud session); maps to `--run-on`. Absent = local. */
  target?: AgentLocation
  /**
   * Post a Discord message when a new item lands on the "needs you" queue (#627). Absent = off:
   * unlike the in-browser toggle, Discord reaches you when no dashboard is open, so it is opt-in.
   * Gates the daemon watcher *on top of* a `DISCORD_WEBHOOK` being set (the webhook is where to
   * post; this is whether to).
   */
  notifyDiscord?: boolean
  /**
   * Auto PM (#685): let the daemon start a PM agent by itself when the agent queue has run dry
   * and there is plenty of budget left, so leftover subscription quota goes on the roadmap
   * instead of expiring. **Absent = off**: it spends the user's allowance without being asked,
   * so it is opt-in like {@link notifyDiscord} rather than a baseline.
   */
  autoPm?: boolean
  /**
   * The browser bridge (#1237): let an extension running in the user's own Claude session report
   * the question a Claude web agent is parked on, so it shows in the dashboard rather than only on
   * claude.ai. **Absent = off.** It opens the daemon's one route reachable from another origin,
   * so it is opt-in rather than a baseline, and turning it on is what mints the bridge token.
   */
  bridge?: boolean
  /**
   * The routines {@link autoPm} must not fire, by {@link AutoPmJob.name} (#1209). Absent or empty
   * = every routine runs, which is what the sweep did before this existed.
   *
   * Opted *out* rather than opted in, so the list only ever names exceptions: a routine added in a
   * later version is on for everyone, instead of silently never running for whoever saved the
   * setting before it shipped. It names routines rather than indexing them for the same reason
   * {@link AutoPmJob.drains} is a flag — a reorder must not move which one is switched off.
   */
  autoPmOptOut?: string[]
  /**
   * How many agents the routine may keep going at once on one project (#1204). Absent defaults to
   * `DEFAULT_AUTO_PM_CONCURRENCY`, and the value is floored at one, with no upper bound.
   *
   * Only the draining routine fans out: it takes work *off* the queue, one pinned entry per agent,
   * so several at once do disjoint work. The rotation invents work and each of its jobs rewrites
   * the queue file, so it stays one agent per tick whatever this says.
   */
  autoPmConcurrency?: number
  /**
   * The project the Routine work card's "Run now" targets (#1647), by project id. Absent = the
   * first registered project, which is what the card showed before this existed.
   *
   * A setting rather than card state, because the pick decides which repo spends quota and gets
   * branches pushed, and card state forgot it on the most common navigation there is — open a
   * run, come back — so the next click landed on the first project, the user's real one. An id
   * that no longer names a registered project reads as absent.
   */
  autoPmProject?: string
  /**
   * How far the automatic-consumption limit sits from the quota boundary, in percentage points
   * (#960). Absent defaults to {@link DEFAULT_SPEND_OFFSET} — a half-day cushion ahead of the
   * boundary — rather than sitting exactly on it (#960 Edit).
   *
   * Negative holds unattended work back further; positive lets it borrow into the days still to
   * come. It is an *offset* rather than an absolute percentage so the limit travels with the
   * boundary as the week goes on, instead of being overtaken by it on day two.
   */
  autoSpendOffset?: number
  /** User-defined presets (#626): the user's own saved prompts, shown beside the built-in presets. */
  customPresets?: CustomPreset[]
  /**
   * Whether the Overview's Onboarding checklist has been dismissed (#958). Absent = show it,
   * so a fresh install is walked through setup; dismissing only hides it on the Overview, and
   * the same checklist stays available on the settings page.
   */
  onboardingDismissed?: boolean
}

// The bounds the browser's controls and this file's sanitizer both need live in the leaf
// `preference-defaults.ts`; re-exported so this stays the import site for everything that
// already reads them beside `Preferences`.
export {
  MAX_SPEND_OFFSET,
  DEFAULT_SPEND_OFFSET,
  DEFAULT_AUTO_PM_CONCURRENCY,
} from './preference-defaults.js'

/**
 * The credentials the daemon needs to reach a third party, set from the dashboard (#1095).
 *
 * Their tier is the {@link Registry.daemonToken} one, not {@link Preferences}: top-level, so
 * neither the browser bundle nor the per-project override map can ever carry them. Nothing
 * reads a value back out to a client — the dashboard is told only that one is *present*
 * ({@link DiscordCredentialStatus}) — so the registry file stays the one place they exist.
 *
 * The alternative was a second file. This one already holds `daemonToken`, which authenticates
 * every request to a network-reachable daemon, so the file is a secret store since #1051; a
 * second one would only spread the same exposure over two paths to keep 0600 on.
 */
export interface RegistrySecrets {
  /** Where Discord notifications are posted (#627). Overridden by `DISCORD_WEBHOOK` when that is set. */
  discordWebhook?: string
}

/** The {@link RegistrySecrets} keys, as a `Record` so the compiler enforces completeness both
 * ways — the same shape (and the same #944 lesson) as the preference tables below. */
const SECRET_KEYS: Record<keyof RegistrySecrets, true> = {
  discordWebhook: true,
}

/** A bot token is ~70 chars and a webhook URL ~120; bounded so a hostile write can't bloat the file. */
const MAX_SECRET_LENGTH = 500

/** The persisted registry file shape (#410): the project list plus the user preferences. */
export interface Registry {
  projects: ProjectRecord[]
  preferences: Preferences
  /**
   * The shared daemon token (#1051): generated on the first non-loopback bind and reused after.
   * A top-level field, deliberately not a {@link Preferences} one, so it is never shipped to the
   * browser bundle. Absent on a loopback-only machine.
   */
  daemonToken?: string
  /** Third-party credentials set from the dashboard (#1095). Absent until one is saved. */
  secrets?: RegistrySecrets
}

/** A read/write handle for the user preferences, wired into the dashboard's context by the daemon. */
export interface PreferencesStore {
  read(): Promise<Preferences>
  save(preferences: Preferences): Promise<void>
  /**
   * Merge only the keys the caller changed (#1148) and hand back the stored result. Preferred over
   * {@link save}, which replaces the whole block from a snapshot that may already be stale.
   */
  patch(patch: Preferences): Promise<Preferences>
}

/** The registry file name: a single file under `$XDG_CONFIG_HOME` (dotted under `$HOME`). */
export const REGISTRY_FILE = 'the-framework.json'

/** Owner read/write only: the file holds the daemon token (#1051) and the Discord credentials (#1095). */
export const REGISTRY_FILE_MODE = 0o600

/**
 * Deterministic, URL-safe id for a project path: the sanitized basename plus a
 * short hash of the full path, so two repos named alike still get distinct ids.
 * Pure; same path always yields the same id.
 */
export function projectId(path: string): string {
  // djb2, rendered as base36: short, stable, URL-safe. Not cryptographic.
  let hash = 5381
  for (let i = 0; i < path.length; i++) {
    hash = ((hash * 33) ^ path.charCodeAt(i)) >>> 0
  }
  const name = basename(path)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
  return `${name}-${hash.toString(36)}`
}

/**
 * The registry file path, resolved from `env` (injectable so tests never touch
 * the real home): `$XDG_CONFIG_HOME/the-framework.json` when set, else the
 * dotted `$HOME/.the-framework.json`. A single file, not a directory (#390).
 */
export function registryPath(env: NodeJS.ProcessEnv): string {
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, REGISTRY_FILE)
  return join(env.HOME ?? '', '.' + REGISTRY_FILE)
}

/** Minimal fs seam so the registry is unit-testable without touching disk. */
export interface RegistryFs {
  /** Rejects when the file is absent. */
  read(path: string): Promise<string>
  write(path: string, contents: string): Promise<void>
  /** Recursive; used on the registry file's parent dir. */
  mkdir(path: string): Promise<void>
  /**
   * Replace `to` with `from`, atomically. Optional only so an existing implementation of this
   * seam keeps compiling; without it {@link writeRegistry} falls back to the truncate-then-write
   * this method exists to avoid (#991).
   */
  rename?(from: string, to: string): Promise<void>
  /**
   * Narrow a file's permissions. Optional, and best-effort at the call site: this file holds the
   * daemon token (#1051) and the Discord credentials (#1095), so it is written owner-only — but a
   * filesystem that cannot express that (Windows, a FAT volume) must not fail the write.
   */
  chmod?(path: string, mode: number): Promise<void>
}

/** A {@link RegistryFs} backed by `node:fs/promises`. See {@link nodeFs}. */
export function nodeRegistryFs(): RegistryFs {
  const { read, write, mkdir, rename, chmod } = nodeFs()
  return { read, write, mkdir, rename, chmod }
}

/** True when `value` is a well-formed {@link ProjectRecord}. */
function isRecord(value: unknown): value is ProjectRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.path === 'string' && typeof record.addedAt === 'string'
}

/** Keep well-formed records, deduped by resolved path (first wins). */
function dedupeProjects(values: unknown[]): ProjectRecord[] {
  const seen = new Set<string>()
  const projects: ProjectRecord[] = []
  for (const value of values) {
    if (!isRecord(value)) continue
    const key = resolve(value.path)
    if (seen.has(key)) continue
    seen.add(key)
    projects.push(value)
  }
  return projects
}

/** The boolean keys of {@link Preferences}, computed so the table below cannot drift from the type. */
type BooleanPreferenceKey = {
  [K in keyof Preferences]-?: NonNullable<Preferences[K]> extends boolean ? K : never
}[keyof Preferences]

/**
 * Every boolean preference, as a `Record` over {@link BooleanPreferenceKey} so the compiler
 * enforces completeness in both directions (#944): a typo fails as an unknown property, and
 * omitting a newly added boolean preference fails as a missing one. A plain `as const` array
 * only caught the first — an omission made {@link sanitizePreferences} silently drop the new
 * preference on every save, the write-then-vanish failure shape for a settings file.
 */
const BOOLEAN_PREFERENCES: Record<BooleanPreferenceKey, true> = {
  vanilla: true,
  onBeforeMergeableQuality: true,
  browser: true,
  transparent: true,
  notifyBrowser: true,
  notifyDiscord: true,
  notifyNewActivity: true,
  notifyHumanIntervention: true,
  autoPm: true,
  bridge: true,
  onboardingDismissed: true,
}

const PREFERENCE_KEYS = Object.keys(BOOLEAN_PREFERENCES) as BooleanPreferenceKey[]

/** Keep only the known preference fields, so a hand-edited or browser-supplied
 * object never lands junk (or the wrong type) in the user's home file. */
/** The color themes the dashboard offers (#725); anything else means the default `system`. */
const KNOWN_THEMES = ['system', 'light', 'dark'] as const

/** The agent targets the dashboard offers (#1050/#610); anything else means the default `local`. */
function sanitizePreferences(value: unknown): Preferences {
  if (typeof value !== 'object' || value === null) return {}
  const input = value as Record<string, unknown>
  const preferences: Preferences = {}
  for (const key of PREFERENCE_KEYS) {
    if (typeof input[key] === 'boolean') preferences[key] = input[key] as boolean
  }
  // `model` (#628) is a free-form string preference; the rest are booleans. A blank string is "no
  // choice", same as absent, so it is dropped rather than persisted. So is the literal word
  // "Default": that was a picker *label* whose stored value was empty (#1143), and a file carrying
  // it as the value — hand-edited, or written by a build that mistook the two — would otherwise be
  // handed to the CLI as `--model Default` and fail the turn on a word nobody chose.
  const model = typeof input['model'] === 'string' ? input['model'].trim() : ''
  if (model && model.toLowerCase() !== 'default') preferences.model = model
  // `driver` (#650) is constrained to the known set so junk never reaches the agent; the set is the
  // shared node-free vocabulary (agent-names.ts). Default = claude.
  if (isDriverName(input['driver'] as string | undefined)) preferences.driver = input['driver'] as string
  // `editor` (#727) is a free-form CLI name, trimmed and length-capped so junk / a huge string
  // never lands in the file. A blank string is "no choice" (fall back to env / `code`), so dropped.
  if (typeof input['editor'] === 'string' && input['editor'].trim())
    preferences.editor = input['editor'].trim().slice(0, 100)
  // `theme` (#725) is constrained to the known set; anything else (incl. absent) means the default
  // `system`, so it is simply dropped rather than persisted.
  if (typeof input['theme'] === 'string' && (KNOWN_THEMES as readonly string[]).includes(input['theme']))
    preferences.theme = input['theme'] as (typeof KNOWN_THEMES)[number]
  // `target` (#1050) is a string, so the boolean-only PREFERENCE_KEYS loop would silently eat it;
  // it gets its own branch like `theme`, constrained to the known set (anything else = default `local`).
  if (isAgentLocation(input['target'])) preferences.target = input['target']
  // `handoff` (B5) is the one ordinal the three booleans it replaced could never be: a rung, not a
  // combination. Constrained to the ladder, so anything else means the default `pr`.
  if (isHandoffLevel(input['handoff'])) preferences.handoff = input['handoff']
  // `autoSpendOffset` (#960) is the one numeric preference: a slider position in percentage
  // points, clamped so a hand-edited file cannot push the limit somewhere the slider could not.
  const offset = input['autoSpendOffset']
  if (typeof offset === 'number' && Number.isFinite(offset))
    preferences.autoSpendOffset = Math.round(Math.min(Math.max(offset, -MAX_SPEND_OFFSET), MAX_SPEND_OFFSET))
  const customPresets = sanitizeCustomPresets(input['customPresets'])
  if (customPresets.length) preferences.customPresets = customPresets
  // `autoPmOptOut` (#1209) is a list of routine names, kept as free-form strings rather than
  // checked against the catalog: this module is the storage layer and the catalog lives above it,
  // and a name from a newer version must survive a downgrade rather than be erased by it. Empty
  // is dropped like every other empty list — nothing opted out is exactly what absent means.
  const optOut = sanitizeNameList(input['autoPmOptOut'])
  if (optOut.length) preferences.autoPmOptOut = optOut
  // `autoPmConcurrency` (#1204) is a count of agents, rounded like `autoSpendOffset` and floored
  // at one: zero concurrent agents is what the `autoPm` switch already spells, and a hand-edited
  // nought would otherwise wedge the routine with the switch still reading on. No upper bound —
  // how many agents to run at once is the user's call, and the week's allowance paces them anyway.
  const concurrency = input['autoPmConcurrency']
  if (typeof concurrency === 'number' && Number.isFinite(concurrency))
    preferences.autoPmConcurrency = Math.max(Math.round(concurrency), 1)
  // `autoPmProject` (#1647) is a project id, kept as a bounded free-form string rather than checked
  // against the project list for the reason the opt-out names are not checked against the
  // catalog: the card validates it against the projects it shows, and an id of a project removed
  // since simply falls back there. Empty is dropped, which is exactly what absent means.
  const routineProject = input['autoPmProject']
  if (typeof routineProject === 'string' && routineProject.trim()) preferences.autoPmProject = routineProject.trim().slice(0, 100)
  return preferences
}

/** Trimmed, de-duplicated, and bounded in both directions, so a hand-edited file cannot grow the object without limit. */
function sanitizeNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const names = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim().slice(0, 100))
    .filter(Boolean)
  return [...new Set(names)].slice(0, 50)
}

/**
 * Keep only well-formed custom presets (#626): each needs a non-empty id, label, and prompt;
 * label/prompt are trimmed and length-capped, the list capped at {@link CUSTOM_PRESET_LIMITS.count},
 * and duplicate ids dropped. A malformed entry is skipped, not thrown — a bad registry never breaks the read.
 */
export function sanitizeCustomPresets(value: unknown): CustomPreset[] {
  if (!Array.isArray(value)) return []
  const out: CustomPreset[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (out.length >= CUSTOM_PRESET_LIMITS.count) break
    if (typeof raw !== 'object' || raw === null) continue
    const { id, label, prompt } = raw as Record<string, unknown>
    if (typeof id !== 'string' || typeof label !== 'string' || typeof prompt !== 'string') continue
    const trimmedId = id.trim()
    const trimmedLabel = label.trim().slice(0, CUSTOM_PRESET_LIMITS.label)
    const trimmedPrompt = prompt.trim().slice(0, CUSTOM_PRESET_LIMITS.prompt)
    if (!trimmedId || !trimmedLabel || !trimmedPrompt || seen.has(trimmedId)) continue
    seen.add(trimmedId)
    out.push({ id: trimmedId, label: trimmedLabel, prompt: trimmedPrompt })
  }
  return out
}

/**
 * The known secrets, kept only as non-empty trimmed strings (#1095) — the same "a hand-edited
 * file can't smuggle junk in" rule the daemon token gets. An unknown key is dropped, so the
 * block cannot become a scratch space for whatever a caller passes.
 */
function sanitizeSecrets(value: unknown): RegistrySecrets | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  const secrets: RegistrySecrets = {}
  for (const key of Object.keys(SECRET_KEYS) as Array<keyof RegistrySecrets>) {
    const entry = raw[key]
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim().slice(0, MAX_SECRET_LENGTH)
    if (trimmed) secrets[key] = trimmed
  }
  return Object.keys(secrets).length ? secrets : undefined
}

/**
 * Read the whole registry. Forgiving: a missing / unreadable / malformed file — or one in a shape
 * this no longer writes — yields an empty registry, never throws. Projects are deduped by resolved
 * path and unknown preference fields are dropped.
 */
export async function readRegistry(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<Registry> {
  const empty: Registry = { projects: [], preferences: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.read(registryPath(env)))
  } catch {
    return empty
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return empty
  const obj = parsed as Record<string, unknown>
  const projects = Array.isArray(obj.projects) ? dedupeProjects(obj.projects) : []
  const secrets = sanitizeSecrets(obj.secrets)
  return {
    projects,
    preferences: sanitizePreferences(obj.preferences),
    // #1051: kept only as a non-empty string, so a hand-edited registry can't smuggle a junk token.
    ...(typeof obj.daemonToken === 'string' && obj.daemonToken ? { daemonToken: obj.daemonToken } : {}),
    ...(secrets ? { secrets } : {}),
  }
}

/**
 * Write the registry back as pretty object-form JSON, creating the parent dir.
 *
 * Atomic (#991): the JSON goes to a temp file beside the real one and is then renamed over it,
 * the same shape #922 gave the daemon state file. A direct write truncates first, so a crash, a
 * kill or a full disk mid-write left a half file — and {@link readRegistry} reports a malformed
 * file as an empty registry, so every project and preference vanished silently. A failed write
 * now only ever damages the temp file. The temp is left behind on failure rather than swept up:
 * one stray file is the cheaper half of that trade.
 *
 * Written owner-only (#1095): the file carries the daemon token and the Discord credentials, so
 * a default-umask 0644 in a shared home would hand them to every other account on the machine.
 * The mode is set on the temp file, before the rename — narrowing after it would leave a window
 * where the real path is readable. Best-effort: a filesystem with no permission bits still writes.
 */
async function writeRegistry(registry: Registry, fs: RegistryFs, env: NodeJS.ProcessEnv): Promise<void> {
  const file = registryPath(env)
  const { projects, preferences, daemonToken, secrets } = registry
  const contents = {
    projects,
    preferences,
    ...(daemonToken ? { daemonToken } : {}),
    ...(secrets && Object.keys(secrets).length ? { secrets } : {}),
  }
  const json = JSON.stringify(contents, null, 2)
  await fs.mkdir(dirname(file))
  const restrict = (path: string) => fs.chmod?.(path, REGISTRY_FILE_MODE).catch(() => {})
  if (!fs.rename) {
    await fs.write(file, json)
    await restrict(file)
    return
  }
  const temp = `${file}.${process.pid}.tmp`
  await fs.write(temp, json)
  await restrict(temp)
  await fs.rename(temp, file)
}

/**
 * Serializes the read-modify-write mutators below (#991). Each reads the whole registry, edits it
 * and writes it back, and one daemon runs several concurrently: `daemon.ts` and `daemon-runtime.ts`
 * both call {@link addProject} while the dashboard's savePreferences RPC writes through
 * {@link registryPreferencesStore}. Interleaved, the later write was computed from a read taken
 * before the earlier one landed, so it silently dropped it. One tail promise for the module, not
 * one per file: the writes are small, and the registry is a single file per machine anyway.
 */
let mutations: Promise<void> = Promise.resolve()

function serialize<T>(mutate: () => Promise<T>): Promise<T> {
  const result = mutations.then(mutate)
  // A rejected mutation must not poison the queue, and must not surface as an unhandled rejection
  // here — the caller still gets `result`, which carries the error.
  mutations = result.then(
    () => {},
    () => {},
  )
  return result
}

/**
 * Read the registry's project list. Forgiving: a missing / unreadable / malformed
 * file yields `[]`, never throws. Deduped by resolved path, first wins.
 */
export async function listProjects(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProjectRecord[]> {
  return (await readRegistry(fs, env)).projects
}

/**
 * Register a project. Idempotent by resolved path: when the path is already
 * registered, the existing record is returned untouched (addedAt survives);
 * otherwise the new record is appended and the file written back (preferences preserved).
 */
export async function addProject(
  path: string,
  addedAt: string,
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProjectRecord> {
  return serialize(async () => {
    const absolute = resolve(path)
    const registry = await readRegistry(fs, env)
    const existing = registry.projects.find(project => resolve(project.path) === absolute)
    if (existing) return existing

    const record: ProjectRecord = { id: projectId(absolute), path: absolute, addedAt }
    registry.projects.push(record)
    await writeRegistry(registry, fs, env)
    return record
  })
}

/** The user's dashboard preferences (#410), or `{}` when none are stored. */
export async function readPreferences(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<Preferences> {
  return (await readRegistry(fs, env)).preferences
}

/** Persist the dashboard preferences (#410), sanitized, preserving the project list. */
export async function writePreferences(
  preferences: Preferences,
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  return serialize(async () => {
    const registry = await readRegistry(fs, env)
    await writeRegistry({ ...registry, preferences: sanitizePreferences(preferences) }, fs, env)
  })
}

/**
 * Merge `patch` over the stored preferences (#1148) and return the result.
 *
 * The counterpart to {@link writePreferences}, which replaces the whole block: a client that
 * sends its entire snapshot replays every value it happens to hold, so a dashboard tab opened
 * before someone else's change silently reverted it on the tab's next write, whatever key that
 * write was actually about. Sending only the changed keys makes a write touch only what it names.
 *
 * Clearing needs no sentinel: {@link sanitizePreferences} already drops blank strings and empty
 * lists, so `{ editor: '' }` merges in as blank and comes out absent, which is how the dashboard
 * clears the editor today.
 */
export async function patchPreferences(
  patch: Preferences,
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<Preferences> {
  return serialize(async () => {
    const registry = await readRegistry(fs, env)
    const preferences = sanitizePreferences({ ...registry.preferences, ...patch })
    await writeRegistry({ ...registry, preferences }, fs, env)
    return preferences
  })
}

/**
 * The shared daemon token (#1051): read the persisted one, or generate + persist it now. Called
 * only on a non-loopback bind, so a loopback-only machine never grows one. Serialized with the
 * other mutators so two concurrent binds can't each write a different token. `base64url` of 32
 * random bytes: URL-safe, so it drops straight into a `?token=` without encoding.
 */
export async function ensureDaemonToken(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  return serialize(async () => {
    const registry = await readRegistry(fs, env)
    if (registry.daemonToken) return registry.daemonToken
    const daemonToken = randomBytes(32).toString('base64url')
    await writeRegistry({ ...registry, daemonToken }, fs, env)
    return daemonToken
  })
}

/**
 * The stored third-party credentials (#1095), or `{}` when none are set. Daemon-side only —
 * every caller is a service that needs the value itself, never a client read: what the dashboard
 * gets told is presence, in {@link RegistrySecrets}'s doc sense.
 */
export async function readSecrets(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<RegistrySecrets> {
  return (await readRegistry(fs, env)).secrets ?? {}
}

/**
 * Merge a patch into the stored credentials (#1095), leaving everything else in the file alone.
 *
 * A patch, not a whole-object write, because the caller is a UI that edits one field: the bot
 * dialog must not clear the webhook by not knowing it. An explicit `null` (or a blank string)
 * clears a key — that is the Clear button — while `undefined` leaves it as it was, so "not
 * mentioned" and "removed" stay different things. Serialized with the other mutators.
 */
export async function writeSecrets(
  patch: Partial<Record<keyof RegistrySecrets, string | null>>,
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  return serialize(async () => {
    const registry = await readRegistry(fs, env)
    const next: Record<string, string> = { ...registry.secrets }
    for (const key of Object.keys(SECRET_KEYS) as Array<keyof RegistrySecrets>) {
      const value = patch[key]
      if (value === undefined) continue
      const trimmed = (value ?? '').trim()
      if (trimmed) next[key] = trimmed
      else delete next[key]
    }
    // Destructured off rather than overwritten: clearing the last credential must drop the key,
    // and `exactOptionalPropertyTypes` will not let an explicit `undefined` stand in for absent.
    const { secrets: _cleared, ...rest } = registry
    const secrets = sanitizeSecrets(next)
    await writeRegistry(secrets ? { ...rest, secrets } : rest, fs, env)
  })
}

/** The persisted daemon token (#1051), or `undefined` when none exists. A pure read, so a process
 * that only prints the reachable URL never generates one. */
export async function readDaemonToken(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  return (await readRegistry(fs, env)).daemonToken
}

/** A {@link PreferencesStore} bound to the real registry file, wired by the daemon so the
 * dashboard's preferences RPCs read/write the user's home file.
 *
 * `onChange` is handed **the keys the caller wrote**, not the merged result, so a listener can
 * tell "this write switched the setting on" from "it was already on and something else changed"
 * (#1161). It runs after the write has landed, and its failure is swallowed: the save succeeded,
 * and a listener must not be able to report otherwise. Same shape as the Discord store's
 * `onChange` (#1095), for the same reason — a setting saved in the browser has to reach the
 * daemon's own services without a restart.
 */
export function registryPreferencesStore(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
  onChange?: (written: Preferences) => void,
): PreferencesStore {
  const changed = <T>(written: Preferences, result: T): T => {
    try {
      onChange?.(written)
    } catch {
      // The write landed; a listener that throws is not the writer's problem.
    }
    return result
  }
  return {
    read: () => readPreferences(fs, env),
    save: async preferences => changed(preferences, await writePreferences(preferences, fs, env)),
    patch: async patch => changed(patch, await patchPreferences(patch, fs, env)),
  }
}
