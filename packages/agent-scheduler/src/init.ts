import { writeHookLines, type InitOutcome } from 'agent-runner'

/**
 * `init`: this tool's lines written into a dashboard's hooks file, so the scheduler runs while the
 * dashboard is open. The tool writes
 * its own lines: the dashboard names no tool. The lines that start, resume and check a run are
 * `agent-runner`'s, written by its own `init`. The writer is `agent-runner`'s too, with its rule: a
 * person's file is never overwritten, a list gains a line only when it lacks it.
 */

/** The lines, in the order a new file lists them: `open` and `close`, each a list. */
export const HOOK_LINES: Readonly<Record<string, string | readonly string[]>> = {
  open: ['npx agent-scheduler start'],
  close: ['npx agent-scheduler stop --unless-keep-alive'],
}

export type { InitOutcome }

/** Write the lines into `<repo>/.the-framework/hooks.yml`; nothing where the dashboard has no directory. */
export function initHooks(repo: string): Promise<InitOutcome> {
  return writeHookLines(repo, HOOK_LINES)
}
