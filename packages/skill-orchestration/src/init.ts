import { writeHookLines, type InitOutcome } from 'agent-runner'

/**
 * `init`: this tool's line written into a dashboard's hooks file, so the dashboard's Settings reach
 * the subagent settings of a project. The tool writes its own line: the dashboard names no tool. The
 * writer is `agent-runner`'s, with its rule: a person's file is never overwritten.
 */

/** The line: the settings as one JSON value in `SUBAGENTS`. */
export const HOOK_LINES: Readonly<Record<string, string>> = {
  subagents: 'npx orchestration settings "$SUBAGENTS"',
}

/** Write the line into `<repo>/.the-framework/hooks.yml`; nothing where the dashboard has no directory. */
export function initHooks(repo: string): Promise<InitOutcome> {
  return writeHookLines(repo, HOOK_LINES)
}
