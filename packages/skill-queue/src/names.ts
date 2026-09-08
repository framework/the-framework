/**
 * The one name the package hangs off. No node imports, so browser-side code can name it too.
 *
 * The branch itself is not named here: the queue lives on the shared data branch, `agent-data`,
 * whose name `@gemstack/agent-data` exports as `DATA_BRANCH`. A convention, not a setting:
 * `SKILL.md` names the same branch to every agent.
 */

/** The agent queue: `TODO_AGENTS.md` at the branch root. */
export const QUEUE_FILE = 'TODO_AGENTS.md'
