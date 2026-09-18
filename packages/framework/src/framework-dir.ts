/**
 * The directory, under a project root, that holds The Framework's own files.
 *
 * Its own module so every reader and writer of the directory (the hooks file, the project's saved
 * prompts, the activation's `.gitignore`, a run's card, diary and inbox) spells it the same way.
 *
 * Nothing of the product's rides on a branch of its own any more: the agent archives are the
 * `logs` skill's runs, on the shared `agent-data` branch that `@gemstack/agent-data` names (#1769).
 */
export const THE_FRAMEWORK_DIR = '.the-framework'
