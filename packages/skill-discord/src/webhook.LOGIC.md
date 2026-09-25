The webhook [1] a message goes to, where this machine's is saved, and the one POST that sends a message. The webhook is given once per machine and user, in the user's config directory, never in a project; `DISCORD_WEBHOOK` in the environment wins over the saved one [2], so a container or a CI job sets one without a file.

## Context

**Problem**: a webhook lets anyone holding it post to the channel, so it has no business in a repository; and a message carrying an agent's words must not ping people because the text says `@everyone`.

## Glossary

[1] webhook: a Discord channel's webhook URL: a POST to it posts a message in that channel, with no login, so anyone holding it can post there.
[2] the saved webhook: the webhook `discord setup` wrote for this user on this machine, in the file `$XDG_CONFIG_HOME/skill-discord/webhook` (`~/.config/skill-discord/webhook` when `XDG_CONFIG_HOME` is unset or blank), readable and writable by its owner only.

## Business logic — TL;DR

- **Which webhook** - `DISCORD_WEBHOOK`, trimmed, when it holds more than white space (source `env`); else the saved webhook's [2] file, trimmed, when it holds more than white space (source `saved`); else none, a file that cannot be read counting as none.
- **A webhook's shape** - a value that, trimmed, is a URL with the `http` or `https` scheme; nothing else is checked.
- **Saving and forgetting** - the trimmed value and a line break written to a new file, readable and writable by its owner only (mode 600), then renamed over the saved webhook's file, its directories made when missing; forgotten by removing the file, a missing one being no error.
- **A message's length** - a message over 2,000 characters, Discord's limit, is cut to at most 2,000, ending with a line break and `… (cut)`, so a cut message never reads as a whole one; an emoji is never cut in half.
- **The post** - one POST of `{"content":<the message, cut>,"allowed_mentions":{"parse":[]}}` as JSON, so no mention in it pings anyone; a 2xx answer is success; any other answer is a failure with its HTTP status and the first 200 characters of its body; no answer within 15 seconds, or a network error, is a failure with a fixed text that never contains the URL.

## Business logic

### Which webhook

#### Context

**User story**: a person set a webhook on their laptop with `discord setup`; a CI job with no such file sets `DISCORD_WEBHOOK` instead; on a laptop that has both, the environment's is the one used.

#### Business logic

`DISCORD_WEBHOOK` in the environment, trimmed, is used when it holds anything, with the source `env`. Otherwise the saved webhook's [2] file is read and trimmed, and used when it holds anything, with the source `saved`. Otherwise there is no webhook; a missing or unreadable file counts as none. The saved webhook's place follows `XDG_CONFIG_HOME` in the environment, trimmed, and is the home directory's `.config` when it is unset or blank.

### Saving and forgetting

#### Context

**Problem**: the file holds the right to post to the channel, so other users on the machine must not read it.

#### Business logic

Saving makes the file's directories when missing (with the system's default permissions), writes the trimmed webhook and a line break into a new file beside it, `<the file>.<this process's pid>.tmp`, created readable and writable by its owner only (mode 600), and renames that file over the saved webhook's file, replacing any before it. So the webhook is never, even for a moment, in a file others can read, and the saved file has mode 600 whatever the old one had. It answers the file's path. Forgetting removes the file, a missing one being no error, and answers the file's path. The saved webhook's shape is checked before saving (`cli.ts`): the trimmed value must be a URL whose scheme is `http` or `https`, answered "that is not a URL" or "a webhook URL is http or https" otherwise. A webhook coming from `DISCORD_WEBHOOK` is not checked; it is posted to as it is.

### The post

#### Context

**Problem**: Discord refuses a message over 2,000 characters outright, and pings the people a message mentions unless told not to.

#### Business logic

The message is first cut to Discord's limit, counting characters the way JavaScript does (an emoji counts two): one of 2,000 or fewer goes as it is; a longer one keeps its first 1,992 followed by a line break and `… (cut)`, 2,000 in all, except when the 1,992nd is the first half of an emoji: then it keeps 1,991, and the emoji goes whole. It is posted once to the webhook as JSON, `{"content":<the message>,"allowed_mentions":{"parse":[]}}`, the second field telling Discord to ping nobody the text mentions. An answer with a 2xx HTTP status is success. Any other status is a failure, described as "the webhook answered <status>", followed by `: ` and the first 200 characters of the answer's body when it has one. When no answer came within 15 seconds, the failure is "the webhook did not answer within 15 seconds". When the post failed any other way (the network failed, or the URL cannot be posted to, such as one without a scheme or one carrying a user and password), the failure is "could not reach the webhook: the network failed, or the URL cannot be posted to": the error's own text is never passed on, since it can quote the URL, and the URL is the secret. Nothing is retried.
