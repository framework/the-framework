import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The prompts a build session opens with, and the one check that decides between them.
 *
 * This was the driver-backed half of ai-autopilot's `Bootstrap` spine: injectable build / improve
 * steps whose results were wrapped in a synthetic supervised agent so the narration could show a
 * phase. The spine went with the review loop (A3/A5), and the session that used it is now one
 * prompt honoring gates (D2), so what survives is the prompt text itself.
 */

/** Compose the build prompt for an intent. The stack is the agent's call (#545). */
export function buildPrompt(intent: string): string {
  return [
    `Build this app end to end: ${intent}`,
    'The workspace may be empty — if so, scaffold the whole project from scratch:',
    'create package.json with scripts, all config, and every source file, install',
    'the dependencies, and make the app run.',
    'When done, summarize what you built in one short paragraph.',
  ].join('\n')
}

/**
 * Framing for an agent against an *existing* codebase. The greenfield {@link buildPrompt} tells the
 * agent the workspace may be empty and to scaffold from scratch, which is the wrong instruction
 * when the user pointed the framework at a project that already exists (#185).
 *
 * Naming the workspace is the whole job. The rules that used to follow it (do not re-scaffold,
 * read the existing code first, make the smallest coherent set of changes) were dropped in #1224:
 * they told a capable agent how to do its work rather than what the work was, and the one thing it
 * cannot infer, that this codebase already exists, is in the first line. Chosen when the workspace
 * already holds source at build time.
 */
export function extendPrompt(intent: string): string {
  return [
    `Work within the existing codebase in this workspace to deliver: ${intent}`,
    'When done, summarize what you changed in one short paragraph.',
  ].join('\n')
}

/**
 * A hard "the app does not exist yet — create it from scratch" directive, for a build whose
 * opening turn left the workspace empty: the agent stalled rather than scaffolding (#182).
 */
export function scaffoldPrompt(intent: string): string {
  return [
    `The workspace is empty — no app exists here yet. You must create the entire app now from scratch: ${intent}`,
    'This is a from-scratch build, not an edit: do not wait for existing code, and do',
    'not refuse because the directory is empty — that is expected. Scaffold the full',
    'project (package.json with scripts, config, and every source file), install',
    'dependencies, and do not stop until the requested features exist and the app runs.',
  ].join('\n')
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache', '.vite'])
const IGNORED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.gitignore',
  '.npmrc',
  '.DS_Store',
])

/**
 * Whether a workspace holds no app yet — no source file the agent could have
 * produced. Used to detect a build that stalled without scaffolding (#182):
 * lockfiles, dotfiles, and dependency/output dirs do not count. Best-effort and
 * cheap: it stops at the first real file and never throws.
 */
export function isWorkspaceEmpty(dir: string): boolean {
  return !hasSourceFile(dir, 0)
}

function hasSourceFile(dir: string, depth: number): boolean {
  if (depth > 6) return false
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return false // unreadable / missing dir: treat as empty.
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      if (hasSourceFile(join(dir, entry.name), depth + 1)) return true
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name) || entry.name.startsWith('.')) continue
      return true
    }
  }
  return false
}
