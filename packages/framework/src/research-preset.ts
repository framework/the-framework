import { renderPresetPrompt, type PresetParam } from './preset-params.js'

/**
 * The [Research] preset (#331): Rom's problem-variability review, shipped as a
 * direct prompt (see `runPrompt`) rather than a build run — research reviews
 * existing code, so it skips the scope -> architect -> build scaffolding. The
 * `<PARAM:what>` placeholder is the user-facing blank (#330); the CAPS tokens
 * (`<AWAIT>`, `<REVIEW_FILE>`, …) are agent-facing macros defined at the bottom
 * of the prompt itself, and `showMultiSelect()` + `<AWAIT>` becomes a live
 * turn-boundary gate (#339/#340) the dashboard resolves.
 */

/** The preset's name, as the CLI subcommand and the dashboard button use it. */
export const RESEARCH_PRESET_NAME = 'research'

/** The one user param: what to measure. Defaults to `this PR`, per the issue. */
export const RESEARCH_PARAMS: readonly PresetParam[] = [
  { name: 'what', default: 'this PR', description: 'What to measure problem variability of' },
]

/** The prompt template, verbatim from #331 (with `<PARAM:what>` as the blank). */
export const RESEARCH_PROMPT_TEMPLATE = `Measure "problem variability" of <PARAM:what>
- List all high-level flows the code implements, i.e. the list of all "problems" the code solves
- Give a rating for each problem (from 0 to 10) following this criteria: does the code solves the problem in an obviously optimal way (10), or is it highly unclear whether the problem can be solved in a better way (0)?
- Write down the ratings in a new file <REVIEW_FILE>
- Show the list to the user and enable him to select problems via \`showMultiSelect()\`, <AWAIT>
  - Set default to \`true\` for entries with low rating
- For all problems the user selected, add a new entry to <TODO_FILE>
  - The entry: "Deep-dive research for alternative solutions, see <REVIEW_FILE>"

AWAIT: Stop, await user answer before resuming
REVIEW_FILE: \`REVIEW-PROBLEMS_<SESSION_NAME>.agent.md\`
TODO_FILE: \`TODO_<SESSION_NAME>.agent.md\`
SESSION_NAME: the name of the current Git branch — sanitize it to be a SLUG, if name is generic (e.g. \`main\`) then create a succinct SLUG`

/**
 * Render the Research prompt for a target. A blank / omitted `what` falls back
 * to the declared default (`this PR`), so the dashboard button and a bare
 * `framework research` both run with zero input.
 */
export function renderResearchPrompt(what?: string): string {
  return renderPresetPrompt(RESEARCH_PROMPT_TEMPLATE, {
    params: RESEARCH_PARAMS,
    values: { what },
  })
}
