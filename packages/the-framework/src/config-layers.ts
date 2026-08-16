import { DEFAULT_HANDOFF, type HandoffLevel } from './handoff-level.js'
import { BOOLEAN_CONFIG_KEYS, CONFIG_KEYS, type FrameworkFileConfig } from './config.js'

/**
 * Resolving a run's settings across config layers (#841).
 *
 * The layers used to combine with `||`, which meant a flag could only ever turn a mode *on* and
 * the-framework.yml could only ever turn one *on*: no layer could say `false`. #800 needs "a
 * project overrides only what it sets", which cannot be built on OR.
 *
 * So: nearest layer that set a key wins, and a layer that left a key unset does not participate.
 * Absent stays absent, so an existing setup resolves the same way; the one behaviour change is
 * that an explicit `false` in a nearer layer now wins.
 */

/** The run settings a config layer can carry. Keys left `undefined` mean "this layer said nothing". */
export interface AgentConfigValues {
  /** Preset name. */
  preset?: string | undefined
  /** Build event kind the preset applies to (#265). */
  event?: string | undefined
  /** Remove the built-in #326 system prompt, keeping the session controls (#314/C3). */
  vanilla?: boolean | undefined
  /** Run the wrapped agent fully raw (#625). */
  transparent?: boolean | undefined
  /** How far a finished session publishes itself (#1102/#1216/B5). */
  handoff?: HandoffLevel | undefined
}

/** One tier of config, with the label the run narrates when this tier wins a key. */
export interface ConfigLayer {
  /** Where these values came from, e.g. `flag` or `the-framework.yml`. */
  name: string
  values: AgentConfigValues
}

/** What a key resolves to when no layer set it. */
export const RUN_CONFIG_DEFAULTS = {
  vanilla: false,
  transparent: false,
  // `pr` by default (#1102): the zero-config handoff is what makes a session left alone hand
  // itself back. Merging is the rung above, because landing work on the default branch is not
  // reversible the way pushing a branch is (#1216).
  handoff: DEFAULT_HANDOFF,
} as const

/**
 * The nearest layer that set `key`, or `undefined` when none did. Layers are ordered
 * nearest-first: run flags > project user > repo yml > global.
 */
export function resolveConfigKey<K extends keyof AgentConfigValues>(
  layers: readonly ConfigLayer[],
  key: K,
): { value: NonNullable<AgentConfigValues[K]>; from: string } | undefined {
  for (const layer of layers) {
    const value = layer.values[key]
    if (value !== undefined) return { value: value as NonNullable<AgentConfigValues[K]>, from: layer.name }
  }
  return undefined
}

/** A run's settled config, plus which layer supplied each key a layer actually set. */
export interface ResolvedRunConfig {
  presetName?: string | undefined
  buildEvent?: string | undefined
  vanilla: boolean
  transparent: boolean
  /** How far this session publishes itself (#1102/#1216/B5). */
  handoff: HandoffLevel
  /** Winning layer name per key; a key left to its default is absent here. */
  sources: Partial<Record<keyof AgentConfigValues, string>>
}

/** Resolve every run setting over `layers` (nearest first), falling back to {@link RUN_CONFIG_DEFAULTS}. */
export function resolveRunConfig(layers: readonly ConfigLayer[]): ResolvedRunConfig {
  const sources: Partial<Record<keyof AgentConfigValues, string>> = {}
  const pick = <K extends keyof AgentConfigValues>(key: K): NonNullable<AgentConfigValues[K]> | undefined => {
    const hit = resolveConfigKey(layers, key)
    if (!hit) return undefined
    sources[key] = hit.from
    return hit.value
  }
  const preset = pick('preset')
  const event = pick('event')
  const modes = {} as Record<(typeof BOOLEAN_CONFIG_KEYS)[number], boolean>
  for (const key of BOOLEAN_CONFIG_KEYS) modes[key] = pick(key) ?? RUN_CONFIG_DEFAULTS[key]
  return {
    ...(preset ? { presetName: preset } : {}),
    ...(event ? { buildEvent: event } : {}),
    ...modes,
    handoff: pick('handoff') ?? RUN_CONFIG_DEFAULTS.handoff,
    sources,
  }
}

/** The repo tier: `the-framework.yml` as a layer. */
export function fileConfigLayer(file: FrameworkFileConfig, name = 'the-framework.yml'): ConfigLayer {
  const values: AgentConfigValues = {}
  for (const key of CONFIG_KEYS) {
    if (file[key] !== undefined) Object.assign(values, { [key]: file[key] })
  }
  return { name, values }
}

/**
 * A one-line summary of what a layer set and which one won, e.g.
 * `preset=software-development (the-framework.yml), vanilla=off (flag)`. Keys nobody set are
 * left out, so a run with no config anywhere narrates nothing.
 */
export function describeResolvedConfig(config: ResolvedRunConfig): string {
  const shown: [keyof AgentConfigValues, string][] = [
    ['preset', config.presetName ?? ''],
    ...BOOLEAN_CONFIG_KEYS.map((key): [keyof AgentConfigValues, string] => [key, onOff(config[key])]),
    ['handoff', config.handoff],
    ['event', config.buildEvent ?? ''],
  ]
  return shown
    .filter(([key]) => config.sources[key])
    .map(([key, value]) => `${key}=${value} (${config.sources[key]})`)
    .join(', ')
}

function onOff(value: boolean): string {
  return value ? 'on' : 'off'
}
