import { getContext } from 'telefunc'
import { contextProjects } from './context.js'
import { readClaudeTrust, type ClaudeTrust } from '../claude-trust.js'
import type { ProjectSummary } from '../dashboard/projects.js'
import type { AddProjectResult, OnboardingSuggestion } from '../dashboard/types.js'
import type { DashboardContext } from '../dashboard/telefunc-serve.js'

// The Projects sidebar behind the new dashboard (#405): the global registry (#390) the
// daemon and CLI write — id, path, name, activated, last activity. The per-run
// foreground dashboard (#427) scopes this to a single project via the request context.
// The live event stream is its own Telefunc Channel (events.telefunc.ts).
export async function onProjects(): Promise<ProjectSummary[]> {
  return contextProjects().list()
}

/**
 * Add project(s) from the dashboard (#396/#433): install a single repo, or every git
 * repo under a directory, and register each so it joins the Projects list. Like
 * `sendStart` this needs the daemon (it spawns git + writes the shared registry), so it
 * calls the daemon's own `addProject` closure from the Telefunc request context. Returns
 * the daemon's {@link AddProjectResult}; a public host (the relay) leaves it unwired.
 */
export async function sendAddProject(path: string, directory: boolean): Promise<AddProjectResult> {
  const { addProject } = getContext<DashboardContext>()
  if (!addProject) return { ok: false, error: 'adding projects is not enabled on this server' }
  const trimmed = path.trim()
  if (!trimmed) return { ok: false, error: 'a project path is required' }
  return addProject(trimmed, directory)
}

/**
 * The Onboarding checklist's one server-side fact (#958): the directory this server runs in,
 * so the first step can offer "Add {cwd} as project" without the user typing a path.
 *
 * Gated on the same `addProject` wiring as {@link sendAddProject}. A public host (the relay)
 * cannot act on the suggestion anyway, and must not disclose where it runs, so it offers none.
 */
export async function onOnboarding(): Promise<OnboardingSuggestion> {
  const { addProject } = getContext<DashboardContext>()
  if (!addProject) return { cwd: null, cwdProjectId: null }
  const cwd = process.cwd()
  const registered = await contextProjects().list()
  return { cwd, cwdProjectId: registered.find(p => p.path === cwd)?.id ?? null }
}

/**
 * Whether Claude Code trusts this project's root (#1318): the launcher warns before a web run
 * on an untrusted project, which is doomed to die on the CLI's interactive trust dialog
 * (#1314), instead of after it. Read-only — trusting a folder stays the user's own act in the
 * CLI; run worktrees inherit the root's answer. `null` when the project is unknown here, and
 * `known: false` when the CLI's config could not say.
 */
export async function onClaudeTrust(projectId: string): Promise<(ClaudeTrust & { root: string }) | null> {
  const projects = await contextProjects().list()
  const root = projects.find(p => p.id === projectId)?.path
  if (!root) return null
  return { ...(await readClaudeTrust(root)), root }
}
