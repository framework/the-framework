import { definePreset } from './preset-prompt.js'
import { PRESETS_RESEARCH } from './prompts.generated.js'

/**
 * The [Research] preset (#331): Rom's problem-variability review, shipped as a
 * direct prompt (see `runPrompt`) rather than a build run — research reviews
 * existing code, so it skips the scope -> build scaffolding. The
 * `${{ tf.params.what }}` placeholder is the user-facing blank (#330); the CAPS tokens
 * (`<AWAIT>`, `<REVIEW_FILE>`, …) are agent-facing macros defined at the bottom
 * of the prompt itself, and `showMultiSelect()` + `<AWAIT>` becomes a live
 * turn-boundary gate (#339/#340) the dashboard resolves.
 */
const research = definePreset('research', PRESETS_RESEARCH, 'What to measure problem variability of')

/** The preset's name, as the CLI subcommand and the dashboard button use it. */
export const RESEARCH_PRESET_NAME = research.name
/** The one user param: what to measure. Defaults to `this PR`, per the issue. */
export const RESEARCH_PARAMS = research.params
/** The prompt template, verbatim from #331 (with `${{ tf.params.what }}` as the blank). */
export const RESEARCH_PROMPT_TEMPLATE = research.template
/** Render the Research prompt, filling its `${{ tf.params.what }}` blank (defaults to `this PR`). */
export const renderResearchPrompt = research.render
