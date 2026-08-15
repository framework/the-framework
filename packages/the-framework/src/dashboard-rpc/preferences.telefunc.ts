import { contextDiscord, contextPreferences, resolveProjectPath } from './context.js'
import type { DiscordCredentialStatus, DiscordCredentialsPatch } from '../discord-credentials.js'
import { detectEditors, type EditorInfo } from '../dashboard/open-in-app.js'
import { readProjectPresets, writeProjectPresets } from '../project-presets.js'
import type { CustomPreset, Preferences, ProjectPreferences } from '../registry.js'

// The user-preferences surface behind the new dashboard (#410): the Global options (Autopilot,
// Technical, Vanilla, Eco + its section drops) the Start form and choice gate share. Persisted
// daemon-side in the same `the-framework.json` as the project list, so they survive restarts
// with no localStorage. The store is threaded through the Telefunc request context, which the one
// dashboard host always wires (D3) — there is no second host left to degrade for.

/** The outcome of a {@link savePreferences} write. */
export type SavePreferencesResult = { ok: true } | { ok: false; error: string }

/** The user's stored dashboard preferences, or `{}` when the read fails. */
export async function onPreferences(): Promise<Preferences> {
  return contextPreferences().read().catch(() => ({}))
}

/** Persist the dashboard preferences (sanitized in the store). */
export async function savePreferences(preferences: Preferences): Promise<SavePreferencesResult> {
  // A failed write returns the advertised typed error rather than rejecting the RPC, so the
  // client renders it instead of losing the save to an exception it cannot read.
  try {
    await contextPreferences().save(preferences)
    return { ok: true }
  } catch {
    return { ok: false, error: 'failed to save preferences' }
  }
}

/** The outcome of a patch write (#1148): the stored result, so the caller can adopt it. */
export type PatchPreferencesResult<T> = { ok: true; preferences: T } | { ok: false; error: string }

/**
 * Merge the keys the caller changed into the stored preferences (#1148), and hand back what is
 * now stored. The write half of the fix for a stale tab reverting settings it never touched:
 * {@link savePreferences} replaces the whole block, so a client's snapshot overwrote whatever
 * anyone else had changed since it loaded. Returning the merged result also lets the caller
 * adopt the truth it just wrote against, so a tab converges instead of staying stale.
 */
export async function patchPreferences(patch: Preferences): Promise<PatchPreferencesResult<Preferences>> {
  // Typed error rather than a rejection, like `savePreferences` — one shape for every failure.
  try {
    return { ok: true, preferences: await contextPreferences().patch(patch) }
  } catch {
    return { ok: false, error: 'failed to save preferences' }
  }
}

/**
 * One project's own run options (#840), or `{}` when it overrides nothing. Separate from
 * {@link onPreferences} rather than folded into it: the client needs the two tiers apart to know
 * which one a toggle should write to.
 */
export async function onProjectPreferences(projectId: string): Promise<ProjectPreferences> {
  return contextPreferences().readProject(projectId).catch(() => ({}))
}

/** Persist one project's run options (#840), sanitized in the store. */
export async function saveProjectPreferences(
  projectId: string,
  preferences: ProjectPreferences,
): Promise<SavePreferencesResult> {
  try {
    await contextPreferences().saveProject(projectId, preferences)
    return { ok: true }
  } catch {
    return { ok: false, error: 'failed to save preferences' }
  }
}

/** {@link patchPreferences} for one project's run options (#1148). */
export async function patchProjectPreferences(
  projectId: string,
  patch: ProjectPreferences,
): Promise<PatchPreferencesResult<ProjectPreferences>> {
  try {
    return { ok: true, preferences: await contextPreferences().patchProject(projectId, patch) }
  } catch {
    return { ok: false, error: 'failed to save preferences' }
  }
}

/**
 * A project's shared custom presets (#1025), committed into its `.the-framework/` so they travel
 * with the repo — the team-shared counterpart to the user-tier {@link onPreferences} presets. Read
 * from the project's own checkout, so this resolves the project id to its workspace path rather than
 * touching the home registry. `[]` for an unknown project.
 */
export async function onProjectPresets(projectId: string): Promise<CustomPreset[]> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return []
  return readProjectPresets(cwd).catch(() => [])
}

/** Persist a project's shared custom presets into its `.the-framework/` (#1025). */
export async function saveProjectPresets(
  projectId: string,
  presets: CustomPreset[],
): Promise<SavePreferencesResult> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return { ok: false, error: 'unknown project' }
  try {
    await writeProjectPresets(cwd, presets)
    return { ok: true }
  } catch {
    return { ok: false, error: 'failed to save presets' }
  }
}

/** The editors installed on this server (#727), for the "Preferred editor" picker. */
export async function onEditors(): Promise<EditorInfo[]> {
  return detectEditors().catch(() => [])
}

/** Which notification channels the daemon can actually deliver on (#948). */
export interface NotifyChannels {
  /** A webhook is set, so Discord delivery can fire. */
  discordWebhook: boolean
  /**
   * Where each credential came from (#1095), so the UI can offer an edit for one it stores and
   * say "set on the daemon" for one it cannot touch. An absent key means that credential is
   * not set. Still presence, never a value — nothing here can be turned back into a credential.
   */
  sources: DiscordCredentialStatus
  /** Whether this host can store a credential at all. */
  editable: boolean
}

/**
 * Whether the daemon has the Discord credentials (#948/#1095). The toggles are per-user
 * preferences, but delivery needs a webhook / a bot token on the daemon — without this read the
 * dashboard let you switch on a channel that delivers nothing and lit the bell for it.
 *
 * Only presence is reported, never the values, and that is the whole contract: a credential set
 * from the dashboard (#1095) lives daemon-side and is never read back to a browser, so this stays
 * booleans plus where each came from.
 */
export async function onNotifyChannels(): Promise<NotifyChannels> {
  const sources = await contextDiscord().status().catch((): DiscordCredentialStatus => ({}))
  return { discordWebhook: sources.webhook !== undefined, sources, editable: true }
}

/**
 * Store (or clear) the Discord credentials from the dashboard (#1095) — the step that used to
 * need an edit to the daemon's environment and a restart, which made it the one onboarding step
 * you could not finish in-product.
 *
 * Write-only on purpose: there is no companion read. The value goes daemon-side, and the browser
 * only ever learns that it is there ({@link onNotifyChannels}). The store applies it live, so the
 * bot connects and the watchers start on the save rather than at the next daemon start.
 *
 * The exposure is bounded by the guard the rest of this surface already sits behind: on a
 * non-loopback bind every route requires the shared token (#1051), and anyone through that guard
 * can start runs — strictly more than setting a webhook URL.
 */
export async function saveDiscordCredentials(patch: DiscordCredentialsPatch): Promise<SavePreferencesResult> {
  return contextDiscord().save(patch).catch(() => ({ ok: false as const, error: 'failed to save' }))
}
