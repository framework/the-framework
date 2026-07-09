import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The built-in system prompt injected into every run (#301): Rom's validated
 * "anti-lazy-pill" (#297). It decouples what the agent *thinks* it should build
 * from what we actually build next: unclear scope becomes a ranked list to show,
 * a large scope becomes a `PLAN.md` to approve, a very large one also spins off a
 * `TODO.md` backlog. In our Instagram-clone test this turned a mock UI shell
 * (0/7 real) into a real persisted backend (~4.5/7), and it declares what it
 * descopes instead of silently faking it.
 *
 * `SHOW_IT` / `AWAIT` fully wire up with the interactive `<Choices>` panel (#304);
 * until then a headless run still writes the `PLAN.md` / `TODO.md`, which is the
 * ambition lever we want.
 */
export const ANTI_LAZY_PILL = `## How to work
- If it isn't clear what you should do (e.g. unclear scope, unclear user prompt), make a list of interpretations sorted by plausibility, SHOW_IT, AWAIT.
- If the scope of what you'll work on is large, create a \`PLAN.md\` of what you'll work on, SHOW_IT, AWAIT.
  - If the scope is potentially very large (e.g. spans over many hours of work), also create a \`TODO.md\` (backlog of follow-up tasks) and SHOW_IT

SHOW_IT: Show it to the user
AWAIT: Stop, await user answer before resuming`

/**
 * The canonical user system-prompt file at the workspace root. Its contents are
 * injected into every prompt, so a project's own instructions travel with the
 * code (Rom's repo-as-database model, like the memory files in {@link ./memory}).
 */
export const SYSTEM_PROMPT_FILE = 'SYSTEM.md'

/**
 * Read the user's system prompt from {@link SYSTEM_PROMPT_FILE} at the workspace
 * root. Returns `undefined` when the file is absent or empty, so the caller falls
 * back to the built-in default alone.
 */
export async function loadUserSystemPrompt(
  dir: string,
  file: string = SYSTEM_PROMPT_FILE,
): Promise<string | undefined> {
  try {
    const content = (await readFile(join(dir, file), 'utf8')).trim()
    return content || undefined
  } catch {
    return undefined
  }
}

/** Inputs to {@link systemPromptBlock}. */
export interface SystemPromptOptions {
  /** Include the built-in {@link ANTI_LAZY_PILL}. Default `true`; set false per repo to remove it. */
  antiLazyPill?: boolean | undefined
  /** The user's own system prompt (e.g. from `SYSTEM.md`), injected after the pill. */
  user?: string | undefined
}

/**
 * Compose the system-prompt block injected into every prompt: the built-in
 * anti-lazy-pill (unless removed) followed by the user's own prompt. Additive, so
 * a repo can keep the pill *and* add its instructions, remove the pill and keep
 * only its own, or leave both off. Returns `''` when there is nothing to inject.
 */
export function systemPromptBlock(opts: SystemPromptOptions = {}): string {
  const parts: string[] = []
  if (opts.antiLazyPill !== false) parts.push(ANTI_LAZY_PILL)
  const user = opts.user?.trim()
  if (user) parts.push(user)
  return parts.join('\n\n')
}
