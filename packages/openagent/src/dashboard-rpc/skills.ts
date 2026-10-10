import { applyChange, carriedSkills, commitSkills, GROUPS, isKnown, readProject, SCHEDULER, skillCount, SKILLS_IN_ALL, skillsOn, uncommittedSkills, type Standing } from '@openagt/init'
import { startScheduler } from '@openagt/agent-scheduler'
import { startBranch } from '../dashboard/start-branch.js'
import { providedDataChanged } from '../store/provided.js'
import { resolveProjectPath } from './context.js'

/**
 * A project's skills, as the dashboard shows and changes them (#2023): the same list with ticks
 * `npx @openagt/init` shows in a terminal, read and written through that package's own code, so
 * the two cannot drift apart. A project has a skill when the skill's text is in its folder; the
 * dashboard writes and deletes those files, and offers the one commit that holds them.
 */

/** One skill of the list, as it stands in the project. */
export interface ProjectSkill {
  name: string
  /** The one line the skill's text says of itself. */
  description: string
  /** How the project's text stands against the one this dashboard carries; `absent` when the project does not hold the skill. */
  standing: Standing
  /** Whether the skill is in the folder but not yet on the branch agents start from: an agent started now does not have it. */
  waiting: boolean
}

export interface ProjectSkills {
  /** How many skills the project has, of how many there are: the ones in its folder, and the basic ones every run gets. */
  has: number
  of: number
  /** The list's groups; `ticked` says whether a group's skills are ticked in a project that has none yet. */
  groups: { title: string; ticked: boolean; skills: ProjectSkill[] }[]
  /** Whether the scheduler starts with the dashboard for this project, on this machine. */
  scheduler: boolean
  /** The branch agents start from, by its name: the remote's default branch, else the branch the folder is on. Absent where there is none. */
  startBranch?: string
  /** How many skill files stand written or deleted in the folder with no commit yet. */
  uncommitted: number
  /** Whether the folder is a git repository: without one there is nothing to commit. */
  git: boolean
}

/** The project's skills; `null` when the project is unknown here. */
export async function onProjectSkills(projectId: string): Promise<ProjectSkills | null> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return null
  const [state, carried, start] = await Promise.all([readProject(cwd), carriedSkills(), startBranch(cwd)])
  const on = start ? await skillsOn(cwd, start.ref) : new Set<string>()
  const standing = new Map(state.skills.map(skill => [skill.name, skill.standing]))
  return {
    has: skillCount(state),
    of: SKILLS_IN_ALL,
    groups: GROUPS.map(group => ({
      title: group.title,
      ticked: group.ticked,
      skills: group.skills.map(name => {
        const stands = standing.get(name) ?? 'absent'
        return { name, description: carried.get(name)!.description, standing: stands, waiting: stands !== 'absent' && start !== undefined && !on.has(name) }
      }),
    })),
    scheduler: state.scheduler,
    ...(start ? { startBranch: start.name } : {}),
    uncommitted: state.git ? await uncommittedSkills(cwd) : 0,
    git: state.git,
  }
}

/** What a change of skills answered: what was written and deleted, and what was left as it is. */
export type ChangeSkillsResult =
  | { ok: true; written: string[]; removed: string[]; left: { path: string; reason: string }[]; schedulerError?: string }
  | { ok: false; error: string }

const names = (value: unknown): string[] | undefined => (value === undefined ? [] : Array.isArray(value) && value.every(name => typeof name === 'string' && name !== SCHEDULER && isKnown(name)) ? [...new Set(value as string[])] : undefined)

/**
 * Write and delete skills in a project's folder, and switch its scheduler: what the "Add skills"
 * screen saves. Only the names of the list are taken; anything else is refused whole. The scheduler
 * switched on starts at once, as its line would have at this dashboard's opening. Nothing is
 * committed here: `sendCommitSkills` is the person's next press.
 */
export async function sendChangeSkills(projectId: string, change: { write?: string[]; remove?: string[]; scheduler?: boolean }): Promise<ChangeSkillsResult> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return { ok: false, error: 'this project has no local path on this server' }
  const write = names(change?.write)
  const remove = names(change?.remove)
  if (!write || !remove || (change.scheduler !== undefined && typeof change.scheduler !== 'boolean')) return { ok: false, error: 'not a list of skills' }
  try {
    const changed = await applyChange(cwd, { write, remove, ...(change.scheduler !== undefined ? { scheduler: change.scheduler } : {}) })
    providedDataChanged(cwd)
    // The scheduler's line runs when the dashboard opens, and this dashboard is open: switched on here, it starts now.
    const started = changed.scheduler && !('error' in changed.scheduler) && changed.scheduler.on && changed.scheduler.changed ? await startScheduler(cwd).then(() => undefined, (err: unknown) => (err instanceof Error ? err.message : String(err))) : undefined
    const schedulerError = changed.scheduler && 'error' in changed.scheduler ? changed.scheduler.error : started
    return { ok: true, written: changed.written, removed: changed.removed, left: changed.left, ...(schedulerError !== undefined ? { schedulerError } : {}) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** One commit of the skill files that stand uncommitted in the project's folder, those alone, on the branch the folder is on. Never a push. */
export async function sendCommitSkills(projectId: string): Promise<{ ok: true; committed: boolean; commit?: string } | { ok: false; error: string }> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return { ok: false, error: 'this project has no local path on this server' }
  return commitSkills(cwd)
}
