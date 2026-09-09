Fixes where the daemon's one Discord credential comes from — the webhook URL its notifications are posted to — and the rules every surface applies to it: the daemon's environment wins over the value saved from the dashboard, a value that cannot possibly work is refused before it is stored, and the dashboard is told only whether a webhook exists and where it came from, never what it is. Reading and writing the saved value is `discord-credentials-store.ts`; this file holds the rules and no credential, which is what lets the dashboard apply the same validation the daemon enforces.

## Context

**User story**: the user enables Discord notifications from the dashboard's Settings by pasting a webhook URL into the Discord dialog, and the daemon posts to it from then on, without a restart. A deployment (a container, a systemd unit, a shared machine) may instead set `DISCORD_WEBHOOK` in the daemon's environment; the dialog then says "Set by `DISCORD_WEBHOOK` in the daemon's environment, so it is not editable here" instead of offering an edit.

**Problem**: a value typed into a browser must not quietly override the machine the daemon runs on, and a credential that was saved must not be readable back out through the dashboard by whoever opens it next.

## Glossary

[1] registry: `~/.the-framework.json`, where the user's dashboard settings (their preferences) are kept; it also lists the projects.

## Business logic — TL;DR

- **One credential, absent means off** - the daemon's Discord credential is the notifications webhook; when neither the environment nor the saved value provides one, Discord notifications are off.
- **The environment wins over the saved value** - a non-blank `DISCORD_WEBHOOK` is the webhook; otherwise the saved value is; a blank variable counts as unset.
- **The dashboard learns presence and origin, never the value** - the status says whether a webhook exists and whether it came from the environment or from the saved value, and nothing in it can be turned back into the webhook.
- **What cannot work is refused before it is stored** - a webhook must be an http or https URL, on any host; clearing is always legal.
- **The store's contract** - a status out, an edit in: a value sets, an explicit null clears, an unmentioned credential is left alone; the answer is success or one error sentence.

## Business logic

### One credential, absent means off

#### Context

See `## Context`.

#### Business logic

The daemon runs with at most one Discord credential: the webhook URL its notifications are posted to. The resolved credentials are empty when neither source below provides one, and empty means Discord notifications are off. The webhook is backed by the environment variable `DISCORD_WEBHOOK` and by one saved value in the registry [1]; the two are tied together in one table so they cannot drift apart, and every rule below loops over that table, so a credential added later is covered by construction.

### The environment wins over the saved value

#### Context

**Problem**: an environment variable is how a deployment configures the daemon; a value typed into a browser must not quietly override it.

#### Business logic

The webhook the daemon runs with is `DISCORD_WEBHOOK` when that variable holds a non-blank value, else the saved value when it is non-blank, else nothing. Surrounding whitespace is trimmed on both. A variable that is set but blank counts as unset: it does not shadow a saved value.

### The dashboard learns presence and origin, never the value

#### Context

**Problem**: a saved credential is not a credential the user can read back, yet the dialog still has to say what is configured and who owns it.

#### Business logic

The status handed to the dashboard says, per credential, only where it came from: `env` when the environment sets it, `stored` when only the saved value does, and nothing at all when neither does. It carries no value, so no field of it can be turned back into the webhook. The environment variable's name, `DISCORD_WEBHOOK`, is also handed to the dashboard, so the dialog can name it in its "set on the daemon" wording.

### What cannot work is refused before it is stored

#### Context

**Problem**: a webhook that is stored and silently does nothing is worse than a refusal at the moment it is typed.

#### Business logic

Validation is deliberately shallow. A value that is blank after trimming is a clearing, and clearing is always legal (it is the dialog's "Remove"). Otherwise the value must parse as a URL, else "That is not a URL."; and its scheme must be http or https, else "A webhook URL must be http or https.". The host is not checked: people front webhooks with their own proxies, and the daemon has no business refusing a URL it was told to post to. Whether the webhook actually authenticates is Discord's answer to give, and the daemon logs that answer when it posts.

### The store's contract

#### Context

See `## Context`.

#### Business logic

The dashboard talks to a store with two operations: the status above, and a save. A save takes a patch: a string sets the credential, an explicit null clears it, and a credential the patch does not mention is left alone. Its answer is either success or a single error sentence for the dialog to show. The daemon wires the store described in `discord-credentials-store.ts`. A daemon that stores no credentials leaves it unwired; the dashboard is then told nothing is configured and every save is refused, and the dialog says "This server does not store credentials, so Discord cannot be set up from here."
