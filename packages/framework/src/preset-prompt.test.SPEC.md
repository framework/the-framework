What the tests cover: a preset's default target is a template rather than a literal, so it can read the launching session (guarding the regression where it reached the prompt as unevaluated text); the default resolves to the session name when a session exists and to "entire codebase" otherwise; an explicit target wins and is trimmed; a blank target falls back to the default; and no unrendered fragment survives a render.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
