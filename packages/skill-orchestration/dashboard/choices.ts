import type { CodingAgent, SettingsOption } from '@openagt/dashboard/module'
import type { Runner } from '../src/levels.js'

// A level's menu: one choice is one coding agent and one model, since a model is always one
// agent's own. The value is `<agent>` for that agent's own default, `<agent> <model>` for a model.

/** The choice that leaves a level unset: the main agent's own coding agent and model. */
export const SAME_AS_MAIN = ''

/** What a choice reads as when the agent's own default is picked. */
export const OWN_DEFAULT = 'its own default'

/**
 * A level's choices: the main agent's own first, then every coding agent, by its own default and by
 * each model it lists. A saved choice the lists do not hold is kept, by its id, so the menu shows
 * what is in force.
 */
export function runnerChoices(agents: readonly CodingAgent[], saved: Runner | undefined): SettingsOption[] {
  const options: SettingsOption[] = [{ value: SAME_AS_MAIN, label: 'Same as the main agent' }]
  for (const agent of agents) {
    options.push({ value: agent.value, label: `${agent.label} · ${OWN_DEFAULT}` })
    for (const model of agent.models) options.push({ value: `${agent.value} ${model.value}`, label: `${agent.label} · ${model.label}` })
  }
  const value = runnerValue(saved)
  if (saved && !options.some(o => o.value === value)) {
    const label = agents.find(a => a.value === saved.driver)?.label ?? saved.driver
    options.push({ value, label: `${label} · ${saved.model ?? OWN_DEFAULT}` })
  }
  return options
}

export function runnerValue(runner: Runner | undefined): string {
  if (!runner) return SAME_AS_MAIN
  return runner.model !== undefined ? `${runner.driver} ${runner.model}` : runner.driver
}

/** The coding agent and model a choice names, or none for "Same as the main agent". */
export function runnerOf(value: string): Runner | undefined {
  const [driver, ...model] = value.split(' ')
  if (!driver) return undefined
  return (model.length > 0 ? { driver, model: model.join(' ') } : { driver }) as Runner
}
