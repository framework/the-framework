The rules of the `discord` skill [1]: the `discord` command's four command lines and their JSON answers, which webhook [2] a message goes to, saving and forgetting the saved webhook [3], and the one POST that sends a message. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: a person runs `discord setup <webhook>` once on their machine; from then on, `discord send "<message>"` run there by the person, by an agent, or by the line a tool running agents runs at a run's end, posts the message in the channel; `discord status` says whether the machine has a webhook without ever showing it.

**Business logic story**: each `discord` call is a short process (`cli.ts`) that reads the command line, finds the webhook (`webhook.ts`: `DISCORD_WEBHOOK` in the environment, else the saved webhook [3]), and, for `send`, posts one message to it and answers how that went. Nothing runs between calls and nothing is kept but the saved webhook's file.

## Glossary

[1] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command on the agent's PATH.
[2] webhook: a Discord channel's webhook URL: a POST to it posts a message in that channel, with no login, so anyone holding it can post there.
[3] the saved webhook: the webhook `discord setup` wrote for this user on this machine, in the file `$XDG_CONFIG_HOME/skill-discord/webhook` (`~/.config/skill-discord/webhook` when `XDG_CONFIG_HOME` is unset or blank), readable and writable by its owner only.

## Business logic — TL;DR

- **The `discord` command** (`cli.ts`, `cli.test.ts`) - `send <message>`, `setup <webhook>`, `setup --clear`, `status`; one JSON line on stdout, a line for a person on stderr, exit 0, 1 or 2.
- **The webhook and the post** (`webhook.ts`) - `DISCORD_WEBHOOK` winning over the saved webhook [3]; a webhook checked only for being an `http` or `https` URL; the file written for its owner only, and removed on `--clear`; a message cut to 2,000 characters, posted with mentions turned off, within 15 seconds.
- **The entry point** (`index.ts`) - re-exports the command's runner and usage, and the webhook's rules.
