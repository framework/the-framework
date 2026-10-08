/** The names the package hangs off. No node imports. */

/** The tool's own directory at the repository root, hidden from git by the tool itself. */
export const STATE_DIR = '.agent-scheduler'

/** The state the tool writes for this user: on or off, the model, the last tick and what it decided. */
export const STATE_FILE = 'state.json'

/** Under the state directory: the scheduler's own log. */
export const SCHEDULER_LOG = 'scheduler.log'

/**
 * Where the coding agent a scheduled run is on, Claude Code, reads a project's skills. A skill that
 * is only in another folder is no command to it: typed with a slash, it expands to nothing.
 */
export const RUN_SKILLS_DIR = '.claude/skills'

/** A skill's file inside its folder: its front matter may hold the skill's `schedule`. */
export const SKILL_FILE = 'SKILL.md'

/** How far a run of a scheduled command publishes on a machine where nobody picked a level for it: it commits its work and pushes nothing. */
export const DEFAULT_PUBLISH = 'commit'

/** The model a scheduled run starts on when the state names none. */
export const DEFAULT_MODEL = 'opus'

/**
 * How far past the spend boundary unattended work may go, in percentage points: half a day of
 * the week's allowance, the same cushion OpenAgent's daemon used.
 */
export const DEFAULT_SPEND_OFFSET = 100 / 14

/** Runs of one command in flight at once, where neither its skill nor a person names a number. */
export const DEFAULT_CAP = 1

/** The most runs of one command a skill or a person may let be in flight at once. */
export const MAX_AGENTS = 99

/** Whether a value is a number of agents at once: a whole number from 1 to 99. */
export function isAgents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_AGENTS
}

/** How often a started scheduler ticks. */
export const TICK_MS = 60_000

/** How long a command's check may run before it counts as failed. */
export const CHECK_TIMEOUT_MS = 60_000
