import { contextAddProject, contextProjectErrors, contextProjects } from './context.js'
import { cachedRepoAutoMerge, type RepoAutoMerge } from '../dashboard/gh.js'
import { preflight, preflightProblems } from '../preflight.js'
import { isDriverName } from '../driver-names.js'
import type { DriverReady } from '../dashboard/types.js'
import type { ProjectSummary } from '../dashboard/projects.js'
import type { AddProjectResult, OnboardingSuggestion } from '../dashboard/types.js'
import type { DashboardContext } from '../dashboard/rpc-serve.js'

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
 * Add project(s) from the dashboard (#396/#433): install a single repo, or every git
 * repo under a directory, and register each so it joins the Projects list. Like
 * `sendStart` this needs the daemon (it spawns git + writes the shared registry), so it
 * calls the daemon's own `addProject` closure off the wired dashboard context. Returns
 * the daemon's {@link AddProjectResult}.
 */
export async function sendAddProject(path: string, directory: boolean): Promise<AddProjectResult> {
  // Throws on an unwired context (D3), like `sendStart`: a missing capability is a wiring bug.
  const addProject = contextAddProject()
  const trimmed = path.trim()
  if (!trimmed) return { ok: false, error: 'a project path is required' }
  return addProject(trimmed, directory)
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

/**
 * Whether this project's repo allows GitHub auto-merge (#1417): the launcher warns when the merge
 * rung is armed on a repo that does not, because the armed merge silently degrades to an immediate
 * direct merge (#1216) — the PR lands before CI has run (#1406). Read-only and cached (#1028).
 * `null` when the project is unknown here; `known: false` when `gh` could not say (not installed,
 * not a GitHub repo), which renders nothing rather than crying wolf — the no-crying-wolf stance (#1318).
 */
export async function onRepoAutoMerge(projectId: string): Promise<RepoAutoMerge | null> {
  const projects = await contextProjects().list()
  const root = projects.find(p => p.id === projectId)?.path
  if (!root) return null
  const cached = await cachedRepoAutoMerge(root)
  return cached.value ?? { known: false, allowed: false }
}

/**
 * Whether the picked driver's CLI can start a session at all (#1326): installed, logged in, and not
 * running as root. The launcher says so before the Start, the way #1318 warns about folder trust,
 * rather than leaving the user with a spent branch and a dashboard stuck on "Waiting for the
 * session to start..." (#1323).
 *
 * Reports problems only, and only ones the user can act on. The passing checks carry the version
 * string and the logged-in account, which are of no use to a launcher and have no business
 * reaching a browser that may be a relay guest, so they stay on this side.
 *
 * `publish` adds the `gh` half (#1419): a launcher with the PR/merge rung armed wants to hear
 * about a missing or logged-out GitHub CLI now, not discover it hours later as a session whose
 * publishing silently stopped at the pushed branch.
 */
export async function onDriverReady(driver: string, publish?: boolean): Promise<DriverReady> {
  const result = await preflight({ driver: isDriverName(driver) ? driver : 'claude', publish: publish === true })
  return {
    ok: result.ok,
    problems: preflightProblems(result),
    warnings: result.checks.filter(c => c.warn).map(c => c.detail),
  }
}
