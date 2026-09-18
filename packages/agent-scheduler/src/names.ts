/** The names the package hangs off. No node imports. */

/** The schedule a person writes and tracks at the repository root: one line per command. */
export const SCHEDULE_FILE = 'agent-schedule.md'

/** The tool's own directory at the repository root, hidden from git by the tool itself. */
export const STATE_DIR = '.agent-scheduler'

/** The state the tool writes for this user: on or off, the model, the last tick and what it decided. */
export const STATE_FILE = 'state.json'

/** Under the state directory: one stderr file per run the tick spawned, and the scheduler's own log. */
export const RUNS_DIR = 'runs'
export const SCHEDULER_LOG = 'scheduler.log'

/** Where the agent's harness looks for a command: the project's tracked skill folder. */
export const COMMANDS_DIR = '.claude/skills'

/** The model a run starts on when the state names none. */
export const DEFAULT_MODEL = 'opus'

/**
 * How far past the spend boundary unattended work may go, in percentage points: half a day of
 * the week's allowance, the same cushion The Framework's daemon used.
 */
export const DEFAULT_SPEND_OFFSET = 100 / 14

/** Runs of one command in flight at once, across every machine, when its line names no cap. */
export const DEFAULT_CAP = 1

/** How often a started scheduler ticks. */
export const TICK_MS = 60_000

/** How long a command's check may run before it counts as failed. */
export const CHECK_TIMEOUT_MS = 60_000

/** The dashboard's directory in a project it knows: made and hidden from git when the project is added. */
export const DASHBOARD_DIR = '.the-framework'

/** The dashboard's hooks file, the lines it runs for the project: where `init` writes this tool's. */
export const DASHBOARD_HOOKS = `${DASHBOARD_DIR}/hooks.yml`
