What the tests cover:

- **The default target is a placeholder, not fixed text** - the default target is itself a placeholder expression, a preset's blank carries it as its default, and no placeholder survives a render.
- **Resolving the default** - with no context, or an empty one, the target is "entire codebase"; with a launching agent's session name the target is that name; an explicit target wins and is trimmed of surrounding whitespace; a target made only of whitespace still falls back to the session name.
