import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BUILD_PROMPT, EXTEND_PROMPT, SCAFFOLD_PROMPT } from './prompts.generated.js'
import { renderTemplate } from './prompt-template.js'

/**
 * The prompts a build session opens with, and the one check that decides between them.
 *
 * The prompt text lives in `prompts/*_prompt.md` like every other agent-facing prompt (#551/#1347);
 * these functions only fill the user's intent into the compiled templates. `tf.prompt` is the same
 * name the system prompt gives the user's prompt.
 */

/** The greenfield build prompt (`prompts/build_prompt.md`). The stack is the agent's call (#545). */
export function buildPrompt(intent: string): string {
  return renderTemplate(BUILD_PROMPT, { tf: { prompt: intent } })
}

/**
 * The existing-codebase prompt (`prompts/extend_prompt.md`), chosen when the workspace already
 * holds source at build time (#185).
 */
export function extendPrompt(intent: string): string {
  return renderTemplate(EXTEND_PROMPT, { tf: { prompt: intent } })
}

/**
 * The scaffold retry prompt (`prompts/scaffold_prompt.md`), for a build whose opening turn left
 * the workspace empty (#182).
 */
export function scaffoldPrompt(intent: string): string {
  return renderTemplate(SCAFFOLD_PROMPT, { tf: { prompt: intent } })
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
