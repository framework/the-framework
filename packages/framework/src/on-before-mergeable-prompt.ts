import { renderTemplate } from './prompt-template.js'
import { ON_BEFORE_MERGEABLE_PROMPT } from './prompts.generated.js'
import { presetContext } from './presets.js'

/**
 * The on-before-mergeable prompt (#326), in `prompts/on_before_mergeable_prompt.md` (#551).
 *
 * It does not *run* the quality presets, it *queues* them: one agent turn that appends
 * "Apply <preset filePath> with tf.params.what set to ..." entries to the project's queue
 * file (`TODO_AGENTS.md`), which a later drain picks up. That is the whole point of
 * #556 — the previous suite executed maintainability, readability and security-audit as
 * three child runs on the spot, which does not compose with the queue.
 *
 * Flattened rather than verbatim, which is the one place this departs from the doc: the
 * doc nests `${{ tf.session_name }}` inside the outer `${{ ... }}` and puts backticks
 * inside a backtick template literal. {@link renderTemplate}'s fragment regex is
 * non-greedy, so the outer fragment closes on the inner `}}` and the remainder is not
 * valid JS. Same branch, same output, one fragment.
 *
 * Two sections: `## Maintenance` queues the quality presets, and `## Business knowledge`
 * (#537) asks the agent to fold what it learned back into {@link BUSINESS_KNOWLEDGE_DOCS}.
 */
export const ON_BEFORE_MERGEABLE_PROMPT_TEMPLATE = ON_BEFORE_MERGEABLE_PROMPT

/** What the on-before-mergeable prompt's fragments read. */
export interface OnBeforeMergeableContext {
  /** The session the finished agent named via setSessionName(). Every line of the prompt names it. */
  session_name: string
  /**
   * The materialized presets, stem -> `{ filePath }` (#326). The `## Maintenance` entries carry
   * `tf.presets.<name>.filePath` so the picked-up agent opens the real preset file. Defaulted
   * from {@link presetContext}, so callers get the standard `.the-framework/presets/*.md` paths.
   */
  presets?: Record<string, { filePath: string }>
}

/** Render the on-before-mergeable prompt for a finished session. */
export function renderOnBeforeMergeablePrompt(tf: OnBeforeMergeableContext): string {
  return renderTemplate(ON_BEFORE_MERGEABLE_PROMPT_TEMPLATE, {
    tf: { ...tf, presets: tf.presets ?? presetContext() },
  })
}
