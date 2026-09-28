Lists the models Claude Code offers: the same list its own `/model` picker shows the person, for their login, each by the id a driver [1] session takes and the name Claude Code shows. Claude Code is started in its streamed JSON mode and sent only its `initialize` request, whose answer carries the list; no prompt is sent, so no model runs and no token is spent.

## Context

**User story**: the user opens the agent and model menu and sees the models their Claude Code offers, by Claude Code's own names ("Opus 5.5", "Fable 5.1"), and the list follows Claude Code when it adds or retires a model.

**Business logic story**: the Claude Code driver lists the models through this reader (`claude-code.ts`); the product asks once and keeps the answer (`packages/framework/src/dashboard/models.ts`).

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[2] stop request: the caller's signal that a driver session, or one turn of it, must end now.

## Business logic — TL;DR

- **Asking Claude Code** - the `claude` command runs in print mode with streamed JSON in and out, plus any extra arguments the driver [1] passes; it is sent Claude Code's `initialize` request and nothing else.
- **Reading the answer** - the answer to that request carries the models in Claude Code's own order; each is its id (such as `opus` or `claude-fable-5-1`), its display name (such as "Opus 5.5") and, when the id is an alias, the full id Claude Code resolves it to today (`claude-opus-5-5`). The "default" entry is left out: it means "no pick", which a caller already has by passing no model. Every other line Claude Code prints is ignored.
- **Stopped once answered** - the process is stopped as soon as the answer is read, and on every failure.
- **Failures in words** - Claude Code's own error for the request, an answer without a model list, a `claude` command that cannot start, a process that exits before answering, no answer within 30 seconds and a stop request [2] each fail the listing with a sentence saying which.
