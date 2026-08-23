The Discord notifications dialog: explains what Discord delivery gives the user, takes the Discord webhook that makes it work, and turns delivery on or off — so setting Discord up is finished inside the product rather than by editing the daemon's environment.

## User story

The user wants an agent that is waiting on them to reach them even with no dashboard open. Discord delivery does that, and it is the one onboarding step that used to end with "edit the daemon's environment and restart it".

## Business logic — TL;DR

- **Explain, take the webhook, toggle delivery** - one dialog covers all three, and its one-line explanation of what Discord delivery does is shown both here and on the Onboarding checklist row that leads here.
- **The webhook goes to the daemon and never comes back** - the dialog learns only that one is stored and where it came from, so a configured webhook offers Replace and Remove instead of a field pre-filled with a secret.
- **A webhook set in the daemon's environment wins** - that case is reported as already handled, naming the environment variable and how to hand control back to the dashboard, rather than offering an edit the daemon would ignore.
- **Delivery can be switched on before the webhook exists** - the toggle says so, and delivery starts working the moment the webhook is set.

## Business logic

### What the dialog shows, by how the webhook stands

#### User story

See `## User story`.

#### Business logic

The dialog always leads with what Discord delivery does, then shows exactly one of four situations:

- **Set in the daemon's environment** — reported as not editable here, naming the environment variable that holds it, and saying that unsetting it and restarting the daemon hands management back to the dashboard.
- **This daemon does not store credentials at all** — says plainly that Discord cannot be set up from here.
- **Already stored on the daemon** — says the webhook is saved and held on the daemon and will never be shown again, with a Replace button that reveals the entry field and a Remove button that deletes it.
- **Not configured** — says so, and gives the numbered steps: open the Discord channel the notifications should land in, create a webhook under Edit Channel → Integrations → Webhooks → New Webhook, copy its URL, paste it below.

#### Rationale

A stored secret is deliberately not the same UI as an unset one: a text box in the settled case invites the user to retype a value they cannot see, and reads as if nothing were configured.

### Entering the webhook

#### User story

The user pastes the URL Discord gave them and expects to be told immediately if they pasted the wrong thing.

#### Business logic

The entry field appears when the daemon can store credentials, the value is not the daemon environment's, and the webhook is either unset or being replaced. The value is masked, excluded from autofill and spellcheck, and checked against the shape a Discord webhook URL must have — a wrong-looking value is called out as it is typed and Save stays unavailable, as it does for an empty value and while a save is in flight. Replacing can be cancelled, which drops what was typed.

A save that the daemon rejects, or that cannot reach the daemon at all, is reported in the dialog and changes nothing. A successful save clears the field, leaves replacement mode, and makes the dialog and the page around it re-read what the daemon now holds, so both agree at once. Removing the webhook is the same act with an empty value, and touches no other stored credential.

Closing the dialog always discards what was typed, so reopening it never hands the next person at the keyboard a secret sitting in a field.

### The delivery toggle

#### User story

Having a webhook and wanting notifications are two separate decisions; the user may want delivery off for a while without throwing the webhook away.

#### Business logic

Below the credential, the dialog states whether Discord delivery is currently on or off and offers the opposite as a single button. The preference is independent of the webhook: with no webhook stored, the toggle still works and says that it starts working once the credential is set.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
