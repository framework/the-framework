import { EXTEND_PROMPT } from './prompts.generated.js'
import { renderTemplate } from './prompt-template.js'

/**
 * The opening prompt of a build session (`prompts/extend_prompt.md`): the work is delivered
 * within the existing codebase (#185) — a project is a repo that already exists, so the old
 * greenfield/scaffold framings are gone (#1683 review). The text lives in `prompts/` like every
 * other agent-facing prompt (#551/#1347); this only fills the user's intent, under the same
 * `tf.prompt` name the system prompt uses.
 */
export function extendPrompt(intent: string): string {
  return renderTemplate(EXTEND_PROMPT, { tf: { prompt: intent } })
}
