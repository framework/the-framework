The `${{ ... }}` markdown-fragment layer (#350): `renderTemplate` evaluates each fragment as a real JS expression against a context, in place, for the #326 system prompt and the presets.

## TLDR

- Each context key becomes a variable the expression can read (e.g. `tf`); the result is stringified in place, text outside fragments passes through byte-identical.
- A fragment that throws or evaluates to `undefined` (almost always a typo) throws `TemplateFragmentError` (carrying the fragment text) rather than silently degrading the prompt.

## Facts

- Fragments are evaluated with `new Function` — arbitrary code execution, so only trusted templates (the built-in prompts) may ever be rendered; never user- or repo-supplied text.
- The fragment regex is non-greedy (`/\$\{\{([\s\S]*?)\}\}/g`), so fragments cannot nest: an inner `}}` closes the outer fragment (why the on-before-mergeable template was flattened and preset defaults avoid nesting).
