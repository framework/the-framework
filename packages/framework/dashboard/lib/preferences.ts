import { useEffect, useSyncExternalStore } from 'react'
import type { CustomPreset, FrameworkFileConfig, Preferences, ProjectSummary } from '../../src/index.js'
import { preferencesFromFileConfig, notifyMethodEnabled, notifyCategoryEnabled } from '../../src/client.js'
import { onPreferences, patchPreferences, onProjectPresets, saveProjectPresets } from '../rpc/preferences.js'
import { onProjects } from '../rpc/projects.js'
import { parseRoute } from './route.js'

// The dashboard's Global options (#410), owned by the daemon and persisted in the same
// `the-framework.json` as the project list — no more localStorage. Loaded once over its RPC
// and cached in this module so every component (the Start form's toggles + the choice-gate
// countdown) reads one shared value and stays in lockstep: an update writes through to the
// cache, notifies subscribers, and persists daemon-side. Prerender has no daemon, so the
// server snapshot is the empty default and the real values load on the client.
//
// A write sends only the keys it changed (#1148) and adopts what comes back. Sending the whole
// cached object meant a tab replayed every value it happened to hold, so a tab open since before
// someone else's change reverted it on its next write — most visibly the theme.
//
// Two tiers (B5): your settings, and the open project's committed `the-framework.yml` on top.
// Only the first is writable — the repo file is edited in the repo — so every write goes to one
// place and there is no split to get wrong. A third tier lived here (the user's per-project
// overrides, #840), duplicating for one machine what the committed file already says for everyone,
// and its price was a write-split, per-tier write bookkeeping and a three-way provenance union.

const EMPTY: Preferences = {}
let cache: Preferences | null = null
let loading: Promise<void> | null = null
/** Each project's committed `the-framework.yml`, as served on the project payload (#842). */
const files = new Map<string, FrameworkFileConfig>()
let filesLoading: Promise<void> | null = null
let filesLoaded = false
/** Each project's shared custom presets, committed in its `.the-framework/custom-presets.json` (#1025). */
const projectPresets = new Map<string, CustomPreset[]>()
const projectPresetLoads = new Set<string>()
const EMPTY_PRESETS: CustomPreset[] = []
/** Resolved snapshots, one per project, cleared on every notify. `useSyncExternalStore` compares
 * snapshots by identity, so resolving fresh on each read would re-render forever. */
let resolved = new Map<string, Preferences>()
let sources = new Map<string, PreferenceSources>()
/**
 * Write bookkeeping per tier (#1148), so nothing the daemon answers can replace the value the
 * user just chose: `writes` orders one write's reply against a newer write's, and `pending`
 * (still in flight, so its keys are not stored yet) tells a refresh to keep its hands off.
 */
let globalWrites = 0
let globalPending = 0
const listeners = new Set<() => void>()

function notify(): void {
  resolved = new Map()
  sources = new Map()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Which of the two tiers a resolved preference came from (#842). Absent = nobody set it. */
export type PreferenceSource = 'repo' | 'global'

/** The winning layer per key, for showing what is inherited rather than yours. */
export type PreferenceSources = Partial<Record<keyof Preferences, PreferenceSource>>

/** The repo tier as preference keys: `the-framework.yml`, committed, shared by everyone who clones. */
function fileTier(projectId: string | null): Preferences {
  const file = projectId ? files.get(projectId) : undefined
  return file ? preferencesFromFileConfig(file) : EMPTY
}

function snapshot(projectId: string | null): Preferences {
  const key = projectId ?? ''
  const hit = resolved.get(key)
  if (hit) return hit
  const repo = fileTier(projectId)
  // Nearest wins (#841): the repo's committed file over your own settings.
  const value = repo === EMPTY ? (cache ?? EMPTY) : { ...(cache ?? EMPTY), ...repo }
  resolved.set(key, value)
  return value
}

function sourceSnapshot(projectId: string | null): PreferenceSources {
  const key = projectId ?? ''
  const hit = sources.get(key)
  if (hit) return hit
  const value: PreferenceSources = {}
  const tiers: [PreferenceSource, Preferences][] = [
    ['global', cache ?? EMPTY],
    ['repo', fileTier(projectId)],
  ]
  // Later tiers are nearer, so each one that set a key overwrites the recorded source.
  for (const [name, values] of tiers) {
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined) value[k as keyof Preferences] = name
    }
  }
  sources.set(key, value)
  return value
}

function ensureLoaded(projectId: string | null): void {
  if (!cache && !loading) {
    loading = onPreferences()
      // `??=`, not `=`: a toggle made while this initial load was in flight already populated
      // the cache and persisted, so the load must not overwrite it with the pre-toggle value.
      .then(preferences => {
        cache ??= preferences
      })
      .catch(() => {
        cache ??= {}
      })
      .finally(() => {
        loading = null
        notify()
      })
  }
  if (!filesLoaded) loadFileConfigs()
  ensureProjectPresetsLoaded(projectId)
}

/**
 * Load every project's `the-framework.yml` off the project payload (#842). One call covers all
 * projects, since that is what the RPC returns; the daemon re-reads the file on each request, so
 * refetching is how the launcher stops showing a stale answer after someone edits the yml.
 */
function loadFileConfigs(): void {
  if (filesLoading) return
  filesLoading = onProjects()
    .then((list: ProjectSummary[]) => {
      files.clear()
      for (const project of list) if (project.fileConfig) files.set(project.id, project.fileConfig)
    })
    .catch(() => {})
    .finally(() => {
      filesLoading = null
      filesLoaded = true
      notify()
    })
}

/**
 * Re-read the repo tier. Wired to the window regaining focus, which is when an edit made in an
 * editor becomes visible to someone looking at the launcher again.
 */
export function refreshFileConfigs(): void {
  loadFileConfigs()
}

if (typeof window !== 'undefined') {
  const refreshAll = () => {
    refreshFileConfigs()
    refreshPreferences()
  }
  window.addEventListener('focus', refreshAll)
  // Switching back to a tab in an already-focused window fires no `focus` event, and that is
  // exactly when a tab is showing values someone changed in another one (#1148).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAll()
  })
}

/** Load a project's shared custom presets (#1025) once, from its committed `.the-framework/`. */
function ensureProjectPresetsLoaded(projectId: string | null): void {
  if (!projectId || projectPresets.has(projectId) || projectPresetLoads.has(projectId)) return
  projectPresetLoads.add(projectId)
  void onProjectPresets(projectId)
    .then(presets => {
      // `??=` reasoning as elsewhere: a save during the load already wrote this entry.
      if (!projectPresets.has(projectId)) projectPresets.set(projectId, presets)
    })
    .catch(() => {
      if (!projectPresets.has(projectId)) projectPresets.set(projectId, [])
    })
    .finally(() => {
      projectPresetLoads.delete(projectId)
      notify()
    })
}

/**
 * The open project's shared custom presets (#1025): the ones committed into its `.the-framework/`,
 * so everyone who clones the repo sees them. Empty with no project open, since there is no repo to
 * read them from.
 */
export function useProjectPresets(): CustomPreset[] {
  const projectId = typeof window === 'undefined' ? null : parseRoute(window.location.pathname).projectId
  const value = useSyncExternalStore(
    subscribe,
    () => (projectId ? (projectPresets.get(projectId) ?? EMPTY_PRESETS) : EMPTY_PRESETS),
    () => EMPTY_PRESETS,
  )
  useEffect(() => ensureProjectPresetsLoaded(projectId), [projectId])
  return value
}

/**
 * Replace the open project's shared presets, write-through then persist into its `.the-framework/`
 * (#1025). Best-effort like {@link updatePreferences}: a failed save is not worth surfacing over a
 * preset edit. A no-op when no project is open — there is no repo to commit them to.
 */
export function saveProjectPresetList(next: CustomPreset[]): void {
  const projectId = activeProjectId()
  if (!projectId) return
  projectPresets.set(projectId, next)
  void saveProjectPresets(projectId, next).catch(() => {})
  notify()
}

/**
 * The project a write belongs to, read straight off the URL (#784 makes it the selection).
 * `updatePreferences` runs in an event handler rather than a render, so it reads the location
 * instead of a hook: no module state to fall out of step with what the user is looking at.
 */
function activeProjectId(): string | null {
  if (typeof window === 'undefined') return null
  return parseRoute(window.location.pathname).projectId
}

/**
 * Merge a patch into the shared preferences, persist it daemon-side, and notify every
 * subscriber so the Start form and the choice gate stay in lockstep. The write-through keeps
 * the UI responsive; the save round-trip is best-effort (a failed save is not worth surfacing
 * over a checkbox toggle).
 *
 * One destination (B5): a repo-shaped setting belongs in the repo's committed file, which is
 * edited in the repo, so everything writable here is yours and goes to the one place.
 */
export function updatePreferences(patch: Partial<Preferences>): void {
  cache = { ...(cache ?? {}), ...patch }
  const seq = ++globalWrites
  globalPending++
  void patchPreferences(patch)
    .then(result => {
      // Adopt what the daemon now stores, so this tab stops being stale about anything another
      // tab changed. Skipped when a newer write has since gone out: that answer is the more
      // recent truth, and it is about to arrive.
      if (result.ok && seq === globalWrites) {
        cache = result.preferences
        notify()
      }
    })
    .catch(() => {})
    .finally(() => globalPending--)
  notify()
}

/**
 * Re-read your settings (#1148). Wired to the window regaining focus, next to
 * {@link refreshFileConfigs}: a tab left open in the background is showing values someone else
 * may have changed, and until #1148 it would also write them back.
 *
 * Skipped while a write is in flight, whether it went out before this read or after it: until the
 * daemon has stored those keys, no read can answer with them, and the write's own reply carries
 * the merged truth anyway.
 */
export function refreshPreferences(): void {
  const seq = globalWrites
  void onPreferences()
    .then(preferences => {
      if (seq !== globalWrites || globalPending > 0) return
      cache = preferences
      notify()
    })
    .catch(() => {})
}

/** The open project's id, or null on a view with none — for deciding a preset can be shared (#1025). */
export function useActiveProjectId(): string | null {
  return typeof window === 'undefined' ? null : parseRoute(window.location.pathname).projectId
}

/**
 * The user preferences in force: your own settings with the open project's committed
 * `the-framework.yml` (#842) on top. Loaded once from the daemon per tier and kept in sync across
 * components.
 */
export function usePreferences(): Preferences {
  const projectId = typeof window === 'undefined' ? null : parseRoute(window.location.pathname).projectId
  const preferences = useSyncExternalStore(
    subscribe,
    () => snapshot(projectId),
    () => EMPTY,
  )
  useEffect(() => ensureLoaded(projectId), [projectId])
  return preferences
}

/**
 * Where each resolved preference came from (#842), so the launcher can show a repo-inherited
 * value as not-yours rather than implying you chose it.
 */
export function usePreferenceSources(): PreferenceSources {
  const projectId = typeof window === 'undefined' ? null : parseRoute(window.location.pathname).projectId
  const value = useSyncExternalStore(
    subscribe,
    () => sourceSnapshot(projectId),
    () => EMPTY_SOURCES,
  )
  useEffect(() => ensureLoaded(projectId), [projectId])
  return value
}

const EMPTY_SOURCES: PreferenceSources = {}

// Autopilot's default-on moved into `framework` with the rest of the preferences ->
// run options mapping (#858), so the daemon resolves it the same way. Re-exported here because
// every component reaches for it through this module.

export type ThemePreference = NonNullable<Preferences['theme']>

/** The chosen dashboard theme (#725); absent follows the OS (`system`). */
export function themePreference(preferences: Preferences): ThemePreference {
  return preferences.theme ?? 'system'
}

/** Whether the dark palette applies, given the theme choice and the OS's dark preference. */
export function resolvedDark(theme: ThemePreference, systemDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemDark)
}

// The notification defaults are the framework's (#627), not the dashboard's: the daemon acts on
// the same values, and the polarities are not uniform, so a second copy here is how the two sides
// drift. These stay as named readers because the call sites read better for it — and each one now
// says which axis it is asking about (B5).

/** Browser delivery; the browser permission is still the real gate. */
export function notificationsEnabled(preferences: Preferences): boolean {
  return notifyMethodEnabled(preferences, 'browser')
}

/** Discord delivery. The daemon's webhook is the other gate (where to post; this is whether to). */
export function discordEnabled(preferences: Preferences): boolean {
  return notifyMethodEnabled(preferences, 'discord')
}

/** The "New activity" category: pings on a session starting or finishing. Composes with the methods above. */
export function newActivityEnabled(preferences: Preferences): boolean {
  return notifyCategoryEnabled(preferences, 'newActivity')
}

/** The "needs you" category: a session awaiting your answer, or a PR to review. */
export function humanInterventionEnabled(preferences: Preferences): boolean {
  return notifyCategoryEnabled(preferences, 'humanIntervention')
}
