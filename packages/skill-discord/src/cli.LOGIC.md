The `discord` command: the command lines a person, an agent [1], or a person's line run by a tool running agents, runs to post to Discord or to set this machine's webhook [2]. Each call is short and answers one JSON line on stdout, a line for a person on stderr when there is something to say, and an exit code that says how it went: 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read.

## Context

**User story**: a person runs `discord setup <webhook>` once; then `discord send "<message>"` posts the message in the channel, and `discord status` says whether the machine has a webhook and where it comes from, never the URL itself.

**Business logic story**: which webhook is used, how it is saved and how a message is posted are `webhook.ts`'s rules; this file is the command line and its answers.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] webhook: a Discord channel's webhook URL: a POST to it posts a message in that channel, with no login, so anyone holding it can post there.
[3] the saved webhook: the webhook `discord setup` wrote for this user on this machine, in the file `$XDG_CONFIG_HOME/skill-discord/webhook` (`~/.config/skill-discord/webhook` when `XDG_CONFIG_HOME` is unset or blank), readable and writable by its owner only.

## Business logic — TL;DR

- **The command line** - `send <message>`, `setup <webhook>`, `setup --clear`, `status`, each with exactly its arguments; no command, an unknown one or a wrong number of arguments prints the usage on stderr and exits 2; `--help` or `-h` prints it on stdout and exits 0.
- **The answers** - one JSON object on stdout with `ok`; `ok: true` exits 0, `ok: false` exits 1 with a `reason` and one line on stderr.
- **`send <message>`** - an empty message is refused `empty`; with no webhook, `no-webhook`; otherwise the message is posted, answered `{"ok":true,"source":…}`, or refused `not-posted` with the detail of what Discord answered, or a fixed text for no answer or a network failure, never the URL.
- **`setup <webhook>`** - a value that is not an `http` or `https` URL is refused `invalid`; otherwise it becomes the saved webhook [3], answered with the file, and with `shadowedBy` when `DISCORD_WEBHOOK` is set and wins over it.
- **`setup --clear`** - the saved webhook's file is removed, whether or not there was one, answered with the file.
- **`status`** - whether a webhook is set and its source, `env` or `saved`, never its URL.

## Business logic

### The command line

#### Context

**Problem**: a wrong command line must never post a message nor touch the saved webhook.

#### Business logic

The command is `discord <command>`. `send` and `setup` take exactly one argument, `status` none. No command, an unknown command or a wrong number of arguments prints the usage on stderr and exits 2, with nothing on stdout, before anything else runs. With `--help` or `-h` as the command, the usage is printed on stdout and the exit code is 0. The usage lists the four command lines with one line each, says `DISCORD_WEBHOOK` in the environment wins over a saved webhook and that `status` never shows the URL, and ends: "JSON on stdout. Exit code 1 for a refusal or a failure (the reason on stderr), 2 for a usage error."

### The answers

#### Context

**Problem**: the same output is read by a program and by a person watching the shell; each needs its own channel.

#### Business logic

Every command that ran prints exactly one JSON object on stdout, with `ok`. When `ok` is true the exit code is 0; when it is false the object carries a `reason`, one line for a person is printed on stderr, and the exit code is 1.

### `send <message>`

#### Context

**User story**: a run ended waiting on a question; the line the person set for that runs `discord send "$MESSAGE"`, and the channel shows `shop: "/work-queue" is waiting for you: Ship it?`.

#### Business logic

A message that is empty or only white space is refused `{"ok":false,"reason":"empty"}` with "the message is empty" on stderr. Otherwise the webhook is found by `webhook.ts`'s rule: `DISCORD_WEBHOOK`, else the saved webhook [3]. With neither, the refusal is `{"ok":false,"reason":"no-webhook"}` with "no webhook on this machine: run `discord setup <webhook>` or set DISCORD_WEBHOOK" on stderr. Otherwise the message is posted as given (`webhook.ts`: cut to 2,000 characters, no mention pinged). A post Discord accepted answers `{"ok":true,"source":"env"|"saved"}`, where the source says which of the two it went to. A post that failed answers `{"ok":false,"reason":"not-posted","detail":…}` with the same detail on stderr: "the webhook answered <HTTP status>: <the first 200 characters of its answer>" (without the colon part when the answer was empty), "the webhook did not answer within 15 seconds", or "could not reach the webhook: the network failed, or the URL cannot be posted to"; no detail ever contains the webhook's URL.

### `setup <webhook>`

#### Context

**User story**: a person copies the webhook from the channel's settings in Discord and runs `discord setup <webhook>` on their machine; every project on that machine now posts there.

#### Business logic

The value, trimmed, must read as a URL whose scheme is `http` or `https`; nothing else of it is checked, since whether it posts is Discord's answer. One that is not a URL is refused `{"ok":false,"reason":"invalid","detail":"that is not a URL"}`, one of another scheme with the detail "a webhook URL is http or https", the detail on stderr. Otherwise the trimmed value becomes the saved webhook [3] (`webhook.ts`), overwriting any before it, and the answer is `{"ok":true,"file":<the file's path>}`. When `DISCORD_WEBHOOK` is set to something other than white space, the answer also carries `"shadowedBy":"DISCORD_WEBHOOK"` and stderr says "saved, but DISCORD_WEBHOOK is set and wins over it"; the exit code is still 0.

### `setup --clear`

#### Context

See `## Context`.

#### Business logic

The saved webhook's file is removed; a file that was not there is no error. The answer is `{"ok":true,"cleared":true,"file":<the file's path>}`. `DISCORD_WEBHOOK`, when set, is not mentioned and still wins on the next `send`.

### `status`

#### Context

**Problem**: an agent must be able to learn whether it can post without ever seeing the webhook.

#### Business logic

The webhook is found by the same rule as for `send`. The answer is `{"ok":true,"webhook":true,"source":"env"|"saved"}` when there is one, `{"ok":true,"webhook":false}` when there is none; the URL is never printed.
