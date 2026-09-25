The instructions an agent [1] reads before posting to Discord: what the `discord` command is and how to reach it, its `send` and `status` commands, how a message goes out, where the webhook [3] comes from and what never to do with it, the refusals, and the line a tool running agents runs at a run's end. Linked into the agent's checkout where the coding agent's harness looks for skills, it is what turns the command into a skill [2]. Its description tells the agent to use it when a task asks it to tell people something on the team's Discord channel.

## Context

**User story**: an agent whose task says to let the team know something on Discord runs `npx discord send "<message>"`; on a machine with no webhook it says so and goes on, since a person sets one.

**Business logic story**: everything the skill says the command does is enforced by `src/cli.ts` and `src/webhook.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command on the agent's PATH.
[3] webhook: a Discord channel's webhook URL: a POST to it posts a message in that channel, with no login, so anyone holding it can post there.

## Business logic — TL;DR

- **How to reach it** - run as `npx discord` from the repository's dependency `@gemstack/skill-discord`, installing with the lockfile's package manager when `node_modules` is missing.
- **The commands the agent runs** - `send "<message>"` posts the message to this machine's webhook [3]; `status` says whether this machine has one and where it comes from.
- **How a message goes out** - quoted as one argument; posted as a Discord message, so Discord's markdown formats it (`*`, `_`, backticks), up to 2,000 characters, a longer one cut and saying so; mentions such as `@everyone` ping nobody.
- **The webhook is a person's** - a person sets it (`setup <webhook>` for this user on this machine, `setup --clear` to forget it, `DISCORD_WEBHOOK` winning over the saved one); the agent never asks for it, never prints it and never writes it into the repository, because anyone holding it can post to the channel.
- **Answers and refusals** - `send`, `setup` and `status` print one JSON line on stdout; a refusal exits 1 with its reason on stderr: `no-webhook` (the agent says so and goes on), `not-posted` (Discord or the network refused, the detail says which and never names the URL), `empty`, and for `setup`, `invalid`; a wrong command line exits 2 with the usage on stderr.
- **A message when a run needs you** - a tool that runs coding agents may run a person's line when a run ends, with the message in `$MESSAGE`; the line to write there is `npx discord send "$MESSAGE"`.
