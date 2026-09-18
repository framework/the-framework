import { contextAddProject, contextProjectErrors, contextProjects, resolveProjectPath } from './context.js'
import { readProjectCommands, type ProjectCommand } from '../project-commands.js'
import { readProjectHooks, runCheckHook, type StartReadiness } from '../project-hooks.js'
import { pickDirectory, type PickDirectoryResult } from '../pick-directory.js'
import type { ProjectSummary } from '../dashboard/projects.js'
import type { AddProjectResult, OnboardingSuggestion } from '../dashboard/types.js'

// The Projects sidebar behind the new dashboard (#405): the global registry (#390) the
// daemon and CLI write — id, path, name, activated, last activity. The per-agent
// foreground dashboard (#427) scopes this to a single project via the request context.
// The live event stream is its own endpoint rather than a call (`GET /_rpc/events`).
//
// Each project also carries what the daemon's background jobs found wrong with it (#1500) —
// a data branch that cannot reach origin, say (#1599). It rides this list rather than a read of
// its own because the list is what every project surface already polls, so an error reaches the
// sidebar dot and the project's banner with nothing new to subscribe to.
export async function onProjects(): Promise<ProjectSummary[]> {
  const errors = contextProjectErrors()
  return (await contextProjects().list()).map(project => {
    const found = errors(project.path)
    return found.length > 0 ? { ...project, errors: found } : project
  })
}

/**
 * Add a project from the dashboard (#396/#433): install the repo and register it so it joins the
 * Projects list. Like `sendStart` this needs the daemon (it spawns git + writes the shared
 * registry), so it calls the daemon's own `addProject` closure off the wired dashboard context.
 * Returns the daemon's {@link AddProjectResult}.
 */
export async function sendAddProject(path: string): Promise<AddProjectResult> {
  // Throws on an unwired context (D3), like `sendStart`: a missing capability is a wiring bug.
  const addProject = contextAddProject()
  const trimmed = path.trim()
  if (!trimmed) return { ok: false, error: 'a project path is required' }
  return addProject(trimmed)
}

/**
 * Open the OS folder picker on the daemon's machine and wait for the user's choice (#1150). The
 * browser cannot learn an absolute path from any picker of its own, and the daemon — which runs on
 * the machine the user is sitting at — can, so the dialog is the daemon's. A dismissed dialog
 * comes back as `path: null`.
 */
export async function sendPickProjectDirectory(): Promise<PickDirectoryResult> {
  return pickDirectory()
}

/**
 * The Onboarding checklist's one server-side fact (#958): the directory this server runs in,
 * so the first step can offer "Add {cwd} as project" without the user typing a path.
 */
export async function onOnboarding(): Promise<OnboardingSuggestion> {
  const cwd = process.cwd()
  const registered = await contextProjects().list()
  return { cwd, cwdProjectId: registered.find(p => p.path === cwd)?.id ?? null }
}

/** What the launcher offers for a project: its commands, and whether a run can be started here at all. */
export interface ProjectLauncher {
  commands: ProjectCommand[]
  /** Whether the project's `.the-framework/hooks.yml` has a `start` line; without one Start is off. */
  startHook: boolean
}

/**
 * The project's commands (#1774), read off its skills folders, and whether it has a start hook.
 * `null` when the project is unknown here.
 */
export async function onCommands(projectId: string): Promise<ProjectLauncher | null> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return null
  const [commands, hooks] = await Promise.all([readProjectCommands(cwd), readProjectHooks(cwd)])
  return { commands, startHook: hooks.start !== undefined }
}

/**
 * What would stop a run in this project before it spends a checkout, said in the launcher before
 * the Start: the project's `check` hook, given the coding agent picked. A missing CLI or a
 * logged-out one is a problem the run itself would refuse on; a warning is said and blocks nothing.
 * A check line that fails is said as a warning: it is a broken check, not a reason to stop.
 * `null` for an unknown project or one without a check hook: nothing to say.
 */
export async function onStartCheck(projectId: string, driver?: string): Promise<StartReadiness | null> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return null
  const checked = await runCheckHook(cwd, driver !== undefined ? { driver } : {})
  if (checked.ok) return { problems: checked.problems, warnings: checked.warnings }
  return checked.noHook ? null : { problems: [], warnings: [checked.error] }
}
