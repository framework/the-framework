import type { AgentLocation, Preferences } from '../../src/index.js'
import { DRIVER_LABELS, isDriverName, type DriverName } from '../../src/client.js'

// What the dashboard calls the three things a start is made of — which CLI, which model, and where
// it runs. One copy, because three surfaces now name them and they must agree: the launcher's
// driver tree, the gear's "Run on" list, and the Routine work card's tooltips (#1506), which are
// the only place a user is told settings that are nowhere on the card they are pressing.
//
// The names and labels of the drivers themselves are the framework's own vocabulary (browser-safe
// via /client); only the model lists and the run-target wording are UI data, which is why they
// live here in the dashboard rather than beside the drivers.

/** The models each driver offers, in the order the menus list them. Every entry is a real model id. */
export const DRIVER_MODELS: Record<DriverName, { value: string; label: string }[]> = {
  claude: [
    { value: 'fable', label: 'Fable' },
    { value: 'opus', label: 'Opus' },
    { value: 'sonnet', label: 'Sonnet' },
    { value: 'haiku', label: 'Haiku' },
  ],
  codex: [
    { value: 'gpt-5-codex', label: 'GPT-5 Codex' },
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'o3', label: 'o3' },
  ],
}

/** What a surface says when no model is pinned and the CLI picks for itself (#1143). */
export const NO_MODEL_PINNED = "the CLI's own default"

/** Where an agent runs, as the gear's list and the Settings page name it. */
export const RUN_TARGET_LABELS: Record<AgentLocation, string> = {
  local: 'This machine',
  actions: 'GitHub Actions',
  web: 'Claude web',
}

/**
 * The settings a start made from these preferences would use, as one line: which CLI, which model,
 * and where it runs.
 *
 * A model is named only within its own driver's list, and nothing is invented when it is missing:
 * a model pinned on the other driver, or never pinned at all, says {@link NO_MODEL_PINNED} rather
 * than borrowing the first entry — the same rule the launcher's trigger follows (#1143), for the
 * same reason. Naming a model the agent will not actually be passed is worse than saying nothing.
 */
export function describeAgentSettings(preferences: Preferences): string {
  const driver: DriverName = isDriverName(preferences.driver) ? preferences.driver : 'claude'
  const model = DRIVER_MODELS[driver].find(m => m.value === preferences.model)?.label ?? NO_MODEL_PINNED
  return [DRIVER_LABELS[driver], model, RUN_TARGET_LABELS[preferences.target ?? 'local']].join(' · ')
}
