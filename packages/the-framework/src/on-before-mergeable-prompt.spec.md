Renders the on-before-mergeable prompt (#326, template in `prompts/on_before_mergeable_prompt.md` #551): one agent turn that queues quality-preset follow-up work and folds learned business knowledge back into the docs.

## TLDR

- The prompt *queues*, not runs, the quality presets (#556): it appends "Apply <preset filePath> with tf.params.what set to ..." entries to the session's TODO file for the backlog loop (#323/#538) to pick up later — replacing the old suite that executed maintainability/readability/security-audit as three child runs on the spot.
- Two sections: `## Maintenance` (queue quality presets) and `## Business knowledge` (#537, fold learnings into the business docs).
- `renderOnBeforeMergeablePrompt(tf, eco)` renders against `session_name`, `settings` (gates the readability entry via `technical_control`), and `presets` (stem → `{filePath}`, defaulted from `presetContext()`).

## Decisions

- `eco.autoMaintenance` (#314) drops only the `## Maintenance` section rather than skipping the whole run: since #537 the prompt also carries `## Business knowledge`, which the flag does not name and must not silently take with it. Dropped before rendering, so the dropped section's fragments never evaluate.
- `settings` is defaulted to `{}` rather than left absent: the template reads `tf.settings.technical_control`, and a missing `settings` would throw `TemplateFragmentError` instead of reading as off.
- The template is flattened vs the doc it came from: the doc nests `${{ tf.session_name }}` inside an outer `${{ ... }}`, but `renderTemplate`'s fragment regex is non-greedy so the outer fragment would close on the inner `}}` — same branch, same output, one fragment.

## Facts

- `## Maintenance` entries carry `tf.presets.<name>.filePath` so the picked-up agent opens the real materialized preset file under `.the-framework/presets/`.
