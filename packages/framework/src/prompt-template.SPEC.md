Renders a prompt template: the prompt is written as ordinary markdown with `${{ ... }}` fragments embedded in it, and each fragment is evaluated at run time against the current context so the prompt an agent receives matches how that agent was actually configured.

## Glossary

- **fragment** - one `${{ ... }}` placeholder inside a prompt template. It holds a real expression — for example a choice on whether autopilot is on — and is replaced by whatever that expression produces.

## Business logic — TL;DR

- **Prompts adapt to the agent** - everything outside a fragment is passed through untouched, and each fragment is replaced in place by its own result, so one committed prompt file serves every combination of settings.
- **A broken fragment stops the render** - a fragment that fails, or that produces nothing (nearly always a typo in the expression), aborts rendering with an error naming the offending fragment, rather than quietly shipping a degraded prompt to the agent.
- **Only trusted templates may be rendered** - fragments are executed as code, so rendering is reserved for prompts The Framework itself ships; never for text supplied by a user or found in a repo.
- **A fragment must never contain two adjacent closing braces** - a fragment ends at the first `}}` it meets, so a nested expression closing two braces together is cut short.

## Business logic

### Prompts adapt to the agent

#### User story

The Framework's built-in system prompt is one committed markdown file, but the instructions it must give differ per agent — whether autopilot is on, which settings apply. The user reads the prompt as prose in the repo, and the agent receives it filled in for its own case.

#### Business logic

Rendering walks the template and replaces each fragment with its result, converted to text. Everything between fragments is reproduced exactly, byte for byte. Each fragment can read the current context by name — for instance the object describing the agent's own parameters.

### A broken fragment stops the render

#### User story

A prompt that silently loses a sentence is far worse than one that fails loudly: nobody notices the agent was under-instructed until the work comes back wrong.

#### Business logic

If a fragment's expression fails, rendering aborts with an error quoting the fragment as it was written and the underlying failure. If the expression produces nothing at all, rendering also aborts — that is almost always a misspelled name — again quoting the fragment.

### Only trusted templates may be rendered

#### Business logic

Each fragment is executed as real code with full access to the running process. Rendering is therefore only ever applied to prompts The Framework ships itself, such as the built-in system prompt. Text coming from a user or from a repository is never rendered.

### A fragment must never contain two adjacent closing braces

#### User story

Someone editing a prompt writes an expression that happens to close two braces in a row and gets a prompt truncated mid-sentence, with no clue why.

#### Business logic

A fragment ends at the first place two closing braces sit next to each other. An expression may nest braces freely, but must never let two of them close together; separating them with a space is the whole fix.

#### Rationale

This is a permanent rule of the fragment language, not a defect awaiting repair: replacing the language outright was considered and declined. Two places already write around it — one block of the built-in system prompt that cannot ship as-is, and the `maintenance` preset — so the rule is recorded here to keep the next author bending around it deliberately instead of debugging a truncated prompt.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
