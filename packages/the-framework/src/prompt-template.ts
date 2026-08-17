import { errorMessage } from './error-message.js'

/**
 * The `${{ ... }}` markdown-fragment layer (#350): the built-in system (#326) prompt embeds
 * JS expressions (e.g. a ternary on `tf.params.autopilot`), so the verbatim
 * template renders against a context at run time. Each fragment is a real JS
 * expression evaluated with `new Function` — that is arbitrary code execution,
 * so only ever render trusted templates (the built-in system prompt), never
 * user- or repo-supplied text.
 */

/**
 * One `${{ ... }}` fragment. Non-greedy, so it ends at the first *adjacent* `}}`: an expression
 * may nest braces, but never let two of them close together — `{a:{b:1}}` ends the fragment on the
 * inner pair, and what gets evaluated is not what was written. A space between them (`{b:1} }`) is
 * the whole fix.
 *
 * A rule of this language, not a bug waiting to be fixed. Replacing the language outright was
 * considered and declined, so the limit is permanent, and two places already bend around it (a
 * block of the system prompt that cannot ship verbatim, and the `maintenance` preset). Written
 * down here so the next one bends on purpose rather than debugging a truncated prompt.
 */
const FRAGMENT = /\$\{\{([\s\S]*?)\}\}/g

/** Thrown when a `${{ ... }}` fragment fails to evaluate or evaluates to `undefined`. */
export class TemplateFragmentError extends Error {
  /** The fragment's expression, as written in the template. */
  readonly fragment: string
  constructor(fragment: string, detail: string) {
    super(`[framework] template fragment \${{${fragment}}} ${detail}`)
    this.name = 'TemplateFragmentError'
    this.fragment = fragment
  }
}

/**
 * Render a template by evaluating every `${{ <expression> }}` fragment against
 * `context` (each key becomes a variable the expression can read, e.g. `tf`).
 * The result is stringified in place; text outside fragments passes through
 * byte-identical. A fragment that throws or evaluates to `undefined` (almost
 * always a typo) throws a {@link TemplateFragmentError} rather than silently
 * degrading the prompt.
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  const names = Object.keys(context)
  const values = names.map(name => context[name])
  return template.replace(FRAGMENT, (_, expression: string) => {
    let result: unknown
    try {
      result = new Function(...names, `'use strict'; return (${expression});`)(...values)
    } catch (err) {
      throw new TemplateFragmentError(expression, `failed to evaluate: ${errorMessage(err)}`)
    }
    if (result === undefined) throw new TemplateFragmentError(expression, 'evaluated to undefined (typo in the expression?)')
    return String(result)
  })
}
