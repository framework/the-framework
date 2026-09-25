The `discord` skill [1]: one message posted to a Discord channel from the shell with the `discord` command (`send`, `setup`, `status`), through the channel's webhook [3], which a person gives each machine once (`discord setup <webhook>`) and which the command saves for that user on that machine, never in a project; `DISCORD_WEBHOOK` in the environment wins over the saved one. A message goes out as a Discord message, formatted by Discord's markdown, cut to Discord's 2,000 characters, and pings nobody; a failure never prints the webhook. `SKILL.md` is what the agent [2] reads; `package.json`, the `tsconfig*.json` files and the ignored build output (`dist/`, `dist-test/`) carry no business logic. The package depends on nothing but Node (22.12 or later); it keeps nothing on the `agent-data` branch, and the product does not depend on it.

## Context

**User story**: a person wants to hear on their team's Discord channel when an agent needs them. They run `npx discord setup <webhook>` once on their machine, and write the line `npx discord send "$MESSAGE"` as the tool running their agents' line for a run's end (for `agent-runner`, the `ended:` line of `.agent-runner/config.yml`); a run that ends waiting on a question, or that opened a pull request, then posts one line in the channel. An agent whose task says to tell people something on Discord runs `npx discord send "<message>"` itself.

**Problem**: a webhook lets anyone holding it post to the channel, so it must never land in a repository nor be printed; and a message that carries an agent's words (a question, a pull request's title) must not ping `@everyone` because the text says so.

## Glossary

[1] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command on the agent's PATH.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] webhook: a Discord channel's webhook URL: a POST to it posts a message in that channel, with no login, so anyone holding it can post there.
[4] the saved webhook: the webhook `discord setup` wrote for this user on this machine, in the file `$XDG_CONFIG_HOME/skill-discord/webhook` (`~/.config/skill-discord/webhook` when `XDG_CONFIG_HOME` is unset or blank), readable and writable by its owner only.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - `send` and `status`, how a message goes out, that a person sets the webhook and the agent never asks for it, prints it or writes it into the repository, the refusals, and the line a tool running agents runs at a run's end.
- **The executable** (`bin/`) - the `discord` command on the agent's PATH, handing the shell to the command's rules.
- **The command and the webhook** (`src/`) - the four command lines and their JSON answers, which webhook a message goes to (`DISCORD_WEBHOOK`, else the saved webhook [4]), saving and forgetting it, and the one POST that sends a message.
