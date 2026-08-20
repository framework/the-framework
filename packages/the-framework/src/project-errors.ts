/**
 * The daemon's per-project error state (#1500): a background job that finds a project in a state
 * the user has to fix — and can only fix if told — records it here, and clears it the moment the
 * state is good again. The dashboard renders what is recorded; nothing else reads it.
 *
 * The first emitter is the data-branch sync (#1599): a push origin rejects, or a repo with no
 * origin at all, used to be a console line on the daemon's stdout and nothing else, which is the
 * worst way to handle a state nobody can see.
 *
 * In memory on purpose. Every emitter re-evaluates on its own cadence — the sync every minute —
 * so a restarted daemon re-learns each error within a tick, and there is no stale record to
 * outlive the condition that raised it.
 */

/** What went wrong, by kind: the dashboard picks its wording from this, the message carries the detail. */
export type ProjectErrorCode = 'data-sync'

export interface ProjectError {
  code: ProjectErrorCode
  /** The detail — what the failing command said, in the words the user would see running it by hand. */
  message: string
  /** ISO timestamp of when the error was first recorded; a re-report of the same code keeps it. */
  since: string
}

/** The daemon's write side: one slot per (project, code). */
export interface ProjectErrors {
  /**
   * Record the error. A second report of the same code on the same project refreshes the message
   * and keeps `since`, so a banner says how long this has been going on rather than resetting
   * every minute.
   */
  set(projectPath: string, code: ProjectErrorCode, message: string): void
  /** The condition is gone; a clear of something never set is a no-op. */
  clear(projectPath: string, code: ProjectErrorCode): void
  /** The project's current errors, oldest first. */
  list(projectPath: string): ProjectError[]
}

/** The dashboard's read side, wired into its context: what the project currently suffers from. */
export type ProjectErrorsReader = ProjectErrors['list']

export function projectErrorStore(now: () => Date = () => new Date()): ProjectErrors {
  const byProject = new Map<string, Map<ProjectErrorCode, ProjectError>>()
  return {
    set(projectPath, code, message) {
      let errors = byProject.get(projectPath)
      if (!errors) byProject.set(projectPath, (errors = new Map()))
      const since = errors.get(code)?.since ?? now().toISOString()
      errors.set(code, { code, message, since })
    },
    clear(projectPath, code) {
      const errors = byProject.get(projectPath)
      if (!errors) return
      errors.delete(code)
      if (errors.size === 0) byProject.delete(projectPath)
    },
    list(projectPath) {
      return [...(byProject.get(projectPath)?.values() ?? [])].sort((a, b) => a.since.localeCompare(b.since))
    },
  }
}
