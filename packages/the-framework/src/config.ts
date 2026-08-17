import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { errorMessage } from './error-message.js'
import { isHandoffLevel, HANDOFF_LEVELS, type HandoffLevel } from './handoff-level.js'

/**
 * The per-repo session defaults persisted in `the-framework.yml`: which preset and modes a project
 * works under, so its config travels with the code instead of being chosen again every session.
 */
export interface FrameworkFileConfig {
  /** Preset to work under, by name. */
  preset?: string
  /** Build event kind the preset's review loop fires for, e.g. `bug-fix` (#265). */
  event?: string
  /**
   * Remove the built-in #326 system prompt, keeping the session controls. Default `false`.
   *
   * One name for one concept (C3). This key used to be `antiLazyPill` — the historical name of
   * the prompt's ancestor (#301) — spelled the other way round from the `vanilla` it mapped to
   * everywhere else, so the file, the preference and the agent option each said the same thing in a
   * different direction and three comments apologised for it.
   */
  vanilla?: boolean
  /**
   * Transparent mode (#625): make every agent in this project a raw `claude -p` — no framework
   * system prompt, no emit protocols, no consumption guard, no dashboard, no TODO loop. The
   * coarse "only-pick-what-you-need" master off-switch, at the per-project tier. Default `false`.
   */
  transparent?: boolean
  /**
   * How far a finished session publishes itself (#1102/#1173/#1216/B5): `local`, `push`, `pr` or
   * `merge`. Default `pr`. Whether a session publishes itself is a fact about the repo, so it
   * belongs in the file that travels with it.
   *
   * `merge` has to be asked for out loud: publishing a branch is reversible, landing it on the
   * default branch is not. Meant for work whose review already happened before the session — the
   * quick-win and consensual routines merge what a plan the human could veto already settled.
   */
  handoff?: HandoffLevel
}

/** Config file names read from the workspace root, in precedence order. */
export const FRAMEWORK_CONFIG_FILES = ['the-framework.yml', 'the-framework.yaml'] as const

/** The free-string config keys, parsed and copied across layers as-is. */
const STRING_CONFIG_KEYS = ['preset', 'event'] as const
/**
 * The keys whose values come from a closed set, so parsing checks the value rather than the type
 * (B5). Only the publish ladder so far; each is validated by name in {@link parseFrameworkConfig}.
 */
const ENUM_CONFIG_KEYS = ['handoff'] as const
/**
 * The boolean-valued mode keys. This is the canonical mode list: parsing, the config-layer copy,
 * resolution, and the resolved-config summary all iterate it, so a new mode is added here once and
 * flows through them (only its default and any renamed output field are declared per key).
 */
export const BOOLEAN_CONFIG_KEYS = ['vanilla', 'transparent'] as const
/** Every config key, string then enum then boolean, in declaration order. */
export const CONFIG_KEYS = [...STRING_CONFIG_KEYS, ...ENUM_CONFIG_KEYS, ...BOOLEAN_CONFIG_KEYS] as const

/**
 * Read `the-framework.yml` (or `.yaml`) from a directory. A missing file yields
 * `{}`. Best-effort: a malformed file is reported via `onWarn` and treated as
 * empty, never a failed agent. CLI flags override whatever this returns.
 */
export async function loadFrameworkConfig(
  dir: string,
  onWarn?: (message: string) => void,
): Promise<FrameworkFileConfig> {
  for (const name of FRAMEWORK_CONFIG_FILES) {
    let raw: string
    try {
      raw = await readFile(join(dir, name), 'utf8')
    } catch {
      continue // not this name; try the next
    }
    try {
      return parseFrameworkConfig(raw, name)
    } catch (err) {
      // parseFrameworkConfig already prefixes the file name in its message.
      onWarn?.(`ignoring ${errorMessage(err)}`)
      return {}
    }
  }
  return {}
}

/**
 * Parse and validate a `the-framework.yml` body into a {@link FrameworkFileConfig}.
 * An empty document is `{}`. Throws on a non-map document or a mistyped field so
 * {@link loadFrameworkConfig} can surface it as a warning.
 */
export function parseFrameworkConfig(raw: string, source = 'the-framework.yml'): FrameworkFileConfig {
  const data = parseYaml(raw) as unknown
  if (data == null) return {}
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${source} must be a YAML map of settings`)
  }
  const obj = data as Record<string, unknown>
  const config: FrameworkFileConfig = {}
  for (const key of STRING_CONFIG_KEYS) {
    if (obj[key] === undefined) continue
    if (typeof obj[key] !== 'string') throw new Error(`${source}: "${key}" must be a string`)
    config[key] = obj[key] as never
  }
  // The one key with a closed set (B5), so it is checked by its values rather than by its type: a
  // typo — or a leftover `handoff: true` — has to be an error, not a silently ignored rung that
  // leaves the repo publishing more than its file says.
  if (obj['handoff'] !== undefined) {
    if (!isHandoffLevel(obj['handoff'])) {
      throw new Error(`${source}: "handoff" must be one of ${HANDOFF_LEVELS.join(' | ')}`)
    }
    config.handoff = obj['handoff']
  }
  for (const key of BOOLEAN_CONFIG_KEYS) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] !== 'boolean') throw new Error(`${source}: "${key}" must be a boolean`)
      config[key] = obj[key] as boolean
    }
  }
  return config
}
