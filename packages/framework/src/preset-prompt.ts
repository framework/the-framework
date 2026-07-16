import { renderTemplate } from './prompt-template.js'

/** A quality preset's single user param: the target to run against. */
export interface PresetParam {
  name: 'what'
  default: string
  description: string
}

/** A quality preset's public shape: its run-kind name, the `what` param, its template, and a renderer. */
export interface PresetDef {
  name: string
  params: readonly [PresetParam]
  template: string
  /** Render the template, filling `${{ tf.params.what }}`; a blank/omitted `what` falls back to the default. */
  render: (what?: string) => string
}

/**
 * Define a quality preset (#326/#330) from the three things that actually differ between them:
 * the run-kind name, the prompt template, and what the one `what` param means. Every preset
 * has the identical shape — a single `what` param defaulting to `this PR`, rendered by filling
 * the `${{ tf.params.what }}` blank — so that shape lives here once instead of in each preset
 * file. A blank/omitted `what` falls back to the default, so a dashboard button runs with zero
 * input; a passed value is trimmed first.
 */
export function definePreset(name: string, template: string, whatDescription: string): PresetDef {
  const params = [{ name: 'what', default: 'this PR', description: whatDescription }] as const
  return {
    name,
    params,
    template,
    render: what => renderTemplate(template, { tf: { params: { what: what?.trim() || params[0].default } } }),
  }
}
