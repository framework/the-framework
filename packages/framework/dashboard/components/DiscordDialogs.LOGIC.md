The "Discord notifications" dialog: explains what the Discord webhook is for, takes the webhook URL and saves it on the daemon, reports whether one is already held and where it came from, and carries the switch that turns Discord delivery on or off. The URL is checked before the round trip, is never read back once stored, and is never left behind in the field when the dialog closes.

## Context

**User story**: the user wants to be reached on Discord when an agent [1] is waiting on them, with no dashboard open. From the onboarding checklist or from Settings they open "Discord notifications", follow three steps to create a webhook in their Discord channel, paste its URL, save it, and turn delivery on. Later they see that a webhook is saved and can replace or remove it.

**Problem**: a credential stored on the daemon is not a credential the browser can read back, so the dialog is only ever told that one exists and where it came from. A credential set in the daemon's environment belongs to the machine's deployment (a container, a service unit, a shared box), and a value typed into a browser must not quietly override it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **What the dialog explains** - titled "Discord notifications", it opens with "Delivers notifications to Discord, so an agent waiting on you reaches you with no dashboard open." and, when nothing is configured, "Not configured yet" with the three setup steps.
- **Where the credential comes from decides the form** - a credential from the daemon's environment is reported as not editable, a daemon that stores no credentials says Discord cannot be set up from here, a stored credential shows as "Webhook URL saved" behind "Replace" and "Remove", and otherwise the field is offered.
- **Checked before the round trip** - a paste that is not a URL, or not an http or https URL, is flagged under the field, and "Save" stays disabled while the field is blank, flagged, or saving.
- **Saving, replacing, removing** - "Save" sends the URL to the daemon and "Remove" clears it; a failure shows the daemon's message or "Could not reach the daemon."; a success makes the host re-read what the daemon holds.
- **Nothing typed survives closing** - closing the dialog empties the field, drops any error and leaves the replace mode.
- **Discord delivery on or off** - a switch reads "Discord delivery on" or "Discord delivery off" with an "Enable" or "Disable" button; it can be turned on before the credential exists.

## Business logic

### What the dialog explains

#### Context

See `## Context`.

#### Business logic

The dialog is titled "Discord notifications" and opens with the one-line description "Delivers notifications to Discord, so an agent waiting on you reaches you with no dashboard open." The same sentence is shown on the onboarding checklist's Discord row, on purpose, because the dialog is also reachable without the checklist. When no webhook is configured, the dialog says "Not configured yet" and lists the steps: "In Discord, open the channel the notifications should land in.", "Edit Channel → Integrations → Webhooks → New Webhook, then Copy Webhook URL.", "Paste it below."

### Where the credential comes from decides the form

#### Context

See `## Context`.

#### Business logic

The dialog is told by its host what the daemon holds: for the webhook, whether one exists and whether it came from the daemon's environment or from the daemon's stored secrets, and whether this daemon stores credentials at all. From that, exactly one of four states shows:

- The webhook comes from the environment: "Set by `DISCORD_WEBHOOK` in the daemon's environment, so it is not editable here. Unset it and restart the daemon to manage it from the dashboard instead." No field is offered, because the environment wins over anything stored and an edit would not take effect.
- The daemon does not store credentials (a public host that keeps no secrets): "This server does not store credentials, so Discord cannot be set up from here." No field is offered. Until the host's first read of the daemon has answered, the dialog reads the same way.
- A webhook is stored and the user has not asked to replace it: a card reading "Webhook URL saved" and "Held on the daemon, and never shown again.", with a "Replace" button and a "Remove" button. The stored value is never shown or pre-filled, because the browser cannot read it back.
- Otherwise (nothing configured, or "Replace" was pressed): the "Not configured yet" block with the steps, and the field. While replacing, a "Cancel" button leaves the replace mode and empties the field.

The field is labeled "Webhook URL", masked like a password, focused when it appears, with the placeholder "https://discord.com/api/webhooks/…" and no browser autocompletion.

### Checked before the round trip

#### Context

**Problem**: a webhook that cannot possibly work would be stored and then silently do nothing; the dialog applies the same shallow check the daemon enforces (the rules in `src/discord-credentials.ts`), so a malformed paste is refused before it travels.

#### Business logic

While the field holds text, it is checked as typed: text that is not a URL is flagged "That is not a URL.", and a URL whose scheme is neither http nor https is flagged "A webhook URL must be http or https."; the flag shows in the warning color under the field. The check is deliberately no stricter: the URL need not be on discord.com, since webhooks are often fronted by a proxy, and whether it actually authenticates is Discord's answer to give. "Save" is disabled while the field is blank (ignoring surrounding whitespace), while it is flagged, and while a save is in flight, when it reads "Saving…".

### Saving, replacing, removing

#### Context

See `## Context`.

#### Business logic

"Save" sends the field's URL to the daemon as an edit that mentions only the webhook, so any other credential the daemon holds is left alone; "Remove" sends a clear for the webhook the same way and is disabled while a save is in flight. When the daemon refuses, its own message shows under the form in the error color; when the daemon cannot be reached at all, the message is "Could not reach the daemon." On success the field is emptied, the replace mode ends, and the host is asked to re-read what the daemon holds, so the dialog and its host agree the moment the save lands.

### Nothing typed survives closing

#### Context

**Problem**: a token sitting in a field of a reopened dialog would be handed to the next person at the keyboard.

#### Business logic

Whenever the dialog closes, the field is emptied, any error is dropped, and the replace mode ends, so reopening it always starts clean.

### Discord delivery on or off

#### Context

**User story**: the user decides whether notifications are posted to Discord at all, independently of whether the webhook is set.

#### Business logic

Below the credential, a card reads "Discord delivery on" or "Discord delivery off" according to the user's preferences [2] (the reading rule in `lib/preferences.ts`), with a "Disable" button when on and an "Enable" button when off; pressing it flips the preference. Under the label, when a webhook is configured, the card explains "Whether notifications are posted to Discord."; when none is configured it explains "Can be turned on now; it starts working once the credential is set." — the switch is never blocked on the credential.
