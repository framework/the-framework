import type { RegistrySecrets } from './registry.js'

/**
 * Where the daemon's two Discord credentials come from (#1095).
 *
 * They used to be environment variables and nothing else, which made "enable Discord" the one
 * onboarding step you could not finish from the dashboard: you had to edit the daemon's
 * environment and restart it. They are now also settable from the UI, stored in the registry file
 * beside the daemon token, and picked up without a restart.
 *
 * The values only ever move daemon-side. This module is the rules — resolution, precedence,
 * validation — and holds no credential itself, which is what lets the dashboard share the same
 * validation the daemon enforces; reading and writing them is `discord-credentials-store.ts`,
 * deliberately a separate file so the home-file edge stays out of the browser bundle.
 *
 * What the dashboard is told is {@link DiscordCredentialStatus}: which credential exists and where
 * it came from, never what it is. That is the presence-only contract `onNotifyChannels` has had
 * since #948, kept on purpose — a stored credential is not a credential you can read back.
 */

/** The resolved credentials a daemon runs with. Absent means Discord notifications are off. */
export interface DiscordCredentials {
  /** Where notifications are posted (#627). */
  webhook?: string
}

/**
 * Which of the two places a credential came from. `env` wins, and the dashboard says so rather
 * than offering an edit that would not take effect: an environment variable is how a deployment
 * (a container, a systemd unit, a shared box) configures the daemon, and a value typed into a
 * browser must not quietly override the machine it is running on.
 */
export type CredentialSource = 'env' | 'stored'

/** Which credentials the daemon holds and where each came from. Presence, never values. */
export interface DiscordCredentialStatus {
  webhook?: CredentialSource
}

/** An edit to the stored credentials: a string sets, `null` clears, absent leaves alone. */
export interface DiscordCredentialsPatch {
  webhook?: string | null
}

/** The outcome of a {@link DiscordCredentialsStore.save}. */
export type SaveCredentialsResult = { ok: true } | { ok: false; error: string }

/** The env var behind each credential, so the two tables below cannot drift apart. */
export const ENV_KEYS = { webhook: 'DISCORD_WEBHOOK' } as const

/** The registry key behind each credential. */
export const SECRET_KEYS = { webhook: 'discordWebhook' } as const satisfies Record<
  keyof DiscordCredentials,
  keyof RegistrySecrets
>

/** The credential names, once, so every loop over them covers both by construction. */
export const CREDENTIALS = Object.keys(ENV_KEYS) as Array<keyof DiscordCredentials>

/** The environment variable a credential is read from, for the UI's "set on the daemon" copy. */
export function credentialEnvVar(credential: keyof DiscordCredentials): string {
  return ENV_KEYS[credential]
}

/** The credentials to run with: the environment first, the stored value as the fallback. */
export function resolveDiscordCredentials(env: NodeJS.ProcessEnv, secrets: RegistrySecrets): DiscordCredentials {
  const resolved: DiscordCredentials = {}
  for (const key of CREDENTIALS) {
    const value = env[ENV_KEYS[key]]?.trim() || secrets[SECRET_KEYS[key]]?.trim()
    if (value) resolved[key] = value
  }
  return resolved
}

/** The same resolution, reported as presence + origin. The browser-facing half of the pair above. */
export function discordCredentialStatus(env: NodeJS.ProcessEnv, secrets: RegistrySecrets): DiscordCredentialStatus {
  const status: DiscordCredentialStatus = {}
  for (const key of CREDENTIALS) {
    if (env[ENV_KEYS[key]]?.trim()) status[key] = 'env'
    else if (secrets[SECRET_KEYS[key]]?.trim()) status[key] = 'stored'
  }
  return status
}

/**
 * Reject what cannot possibly work, before it is stored and silently does nothing.
 *
 * Deliberately shallow: a token is only checked for the shape of a token (one opaque word), and a
 * webhook for being an http(s) URL rather than for being on discord.com — people front webhooks
 * with their own proxies, and the daemon has no business refusing a URL it was told to post to.
 * Whether the credential actually authenticates is Discord's answer to give, and the daemon logs it.
 */
export function validateCredential(credential: keyof DiscordCredentials, value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined // clearing is always legal
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return 'That is not a URL.'
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'A webhook URL must be http or https.'
  return undefined
}

/**
 * The store the dashboard's context carries (#1095): status out, edits in. The daemon
 * wires one; a public host (the relay) leaves it unset, so the RPCs report nothing configured and
 * refuse the write, the same way the preferences store degrades.
 */
export interface DiscordCredentialsStore {
  status(): Promise<DiscordCredentialStatus>
  save(patch: DiscordCredentialsPatch): Promise<SaveCredentialsResult>
}

