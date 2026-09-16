import type { AgentLocation } from '../../src/index.js'
import type { DriverName } from '../../src/client.js'

// What the dashboard calls the three things a start is made of — which CLI, which model, and where
// it runs. One copy, because two surfaces name them and they must agree: the launcher's driver
// tree and the gear's "Run on" list.
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
