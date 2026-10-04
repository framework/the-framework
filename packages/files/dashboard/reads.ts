import type { ModuleHost } from 'framework/module'
import type { ProjectTree } from '../src/server.js'
import type { AgentCommit, AgentTree, FileMark } from '../src/tree.js'
import type { FileChange, FileDiff } from '../src/diff.js'
import type { FileContent } from '../src/read.js'

// The module's reads, typed: each asks the module's own server part (`../src/server.ts`) through
// the dashboard, and throws the reason when the read answers an error, so a polled read keeps the
// last answer it had rather than showing an empty tree.

async function read<T>(host: ModuleHost, projectId: string, name: string, input: Record<string, unknown>): Promise<T> {
  const result = await host.read(projectId, name, input)
  if (!result.ok) throw new Error(result.error)
  return result.output as T
}

/** The project's own files, the ones changed on disk marked. */
export const readProject = (host: ModuleHost, projectId: string) => read<ProjectTree>(host, projectId, 'project', {})

/** A run's files wherever they are now, what it changed marked. */
export const readTree = (host: ModuleHost, projectId: string, agentId: string) => read<AgentTree>(host, projectId, 'tree', { agentId })

/** One changed file's diff: the run's (in one of its commits, when `commit` names one), or the project folder's. */
export const readDiff = (host: ModuleHost, projectId: string, path: string, agentId?: string, commit?: string) =>
  read<FileDiff | null>(host, projectId, 'diff', agentId !== undefined ? { path, agentId, ...(commit !== undefined ? { commit } : {}) } : { path })

/** The commits of a run's work, newest first. */
export const readCommits = (host: ModuleHost, projectId: string, agentId: string) => read<AgentCommit[]>(host, projectId, 'commits', { agentId })

/** What one commit of a run's work changed; null when it is not one of the run's commits. */
export const readCommit = (host: ModuleHost, projectId: string, agentId: string, commit: string) =>
  read<Record<string, FileMark> | null>(host, projectId, 'commit', { agentId, commit })

/** One unchanged file's contents: the run's copy, or the project folder's. */
export const readContent = (host: ModuleHost, projectId: string, path: string, agentId?: string) =>
  read<FileContent | null>(host, projectId, 'content', agentId !== undefined ? { path, agentId } : { path })

/** What a working run has changed so far in its checkout. */
export const readChanges = (host: ModuleHost, projectId: string, agentId: string) => read<FileChange[]>(host, projectId, 'changes', { agentId })
