Renders a prompt's placeholders: every `${{ <expression> }}` in a prompt is a JavaScript expression evaluated against a context whose entries are the variables the expression may read, and its result replaces the placeholder in place while everything else passes through byte for byte. A placeholder that fails, or that evaluates to nothing, fails the whole render with an error naming the placeholder, so a prompt never reaches a coding agent [1] silently degraded. Because a placeholder is arbitrary code, only prompts The Framework ships are ever rendered this way.

## Context

**Business logic story**: the built-in system prompt [2] and the presets are markdown with placeholders, such as a ternary on whether the agent [3] is a build agent, or the target a preset runs against. The prompt files are the only source of truth, so the markdown is rendered against the facts of the moment when an agent starts, or when the dashboard previews a prompt in the browser.

## Glossary

[1] coding agent: The CLI doing the actual work: Claude Code or Codex.
[2] the built-in system prompt: The standing instructions every agent starts with (`prompts/system_prompt.md`).
[3] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Placeholders are expressions** - each `${{ … }}` is evaluated as a JavaScript expression with the context's entries in scope, and its result, as text, takes its place; text outside placeholders is untouched.
- **Only trusted prompts** - evaluation is arbitrary code execution, so only the prompts The Framework ships are rendered, never text the user or a repository supplied.
- **A broken placeholder fails the render** - an expression that throws, or evaluates to nothing, fails the render with an error quoting the placeholder, instead of a prompt with a hole in it.
- **A placeholder ends at the first `}}`** - two closing braces next to each other end the placeholder even inside a nested object, and a space between them is the fix; this is a permanent rule of the notation.

## Business logic

### Placeholders are expressions

#### Context

See `## Context`.

#### Business logic

A placeholder is `${{` followed by an expression and the first `}}` after it. The expression is evaluated in strict mode with each entry of the context available as a variable named by its key (the prompts read one named `tf`), and the value is converted to text and written where the placeholder stood. Everything outside placeholders is copied unchanged.

### Only trusted prompts

#### Context

**Problem**: an expression is run as code on the daemon's machine, so a placeholder in text from an untrusted source would be code execution by whoever wrote the text.

#### Business logic

Rendering is reserved for prompts shipped with The Framework: the built-in system prompt [2] and the presets. Text supplied by the user or read from a repository is never rendered as a prompt with placeholders.

### A broken placeholder fails the render

#### Context

**Problem**: a placeholder that evaluates to nothing is almost always a typo in the expression, and a prompt that reached the coding agent [1] with "undefined" or an empty hole in it would degrade the agent's [3] work without anyone noticing.

#### Business logic

An expression that throws fails the render with "[framework] template fragment ${{<expression>}} failed to evaluate: <reason>". An expression whose value is undefined fails it with "[framework] template fragment ${{<expression>}} evaluated to undefined (typo in the expression?)". The error carries the expression as written, and nothing partial is returned.

### A placeholder ends at the first `}}`

#### Context

**Problem**: the notation was kept as is rather than replaced, so its one limit is permanent and is written down so the next prompt bends around it on purpose instead of debugging a truncated prompt.

#### Business logic

A placeholder ends at the first pair of adjacent closing braces. An expression may contain nested braces, but two of them must never close together: in `{a:{b:1}}` the placeholder ends at the inner pair and what is evaluated is not what was written. A space between the two braces (`{b:1} }`) avoids it. One block of the built-in system prompt [2] and the "Maintenance" preset are written around this limit.
