The two Discord setup dialogs — the bot and notifications — that explain the integration, take its credential, and toggle the matching preference, so Discord is set up inside the product instead of by editing the daemon's environment and restarting it.

## TLDR

- A credential is write-only: it goes to the daemon and never comes back, so a stored one reads "saved" with Replace and Remove instead of a field holding a secret.
- A credential set in the daemon's environment wins over a stored one, so that case is reported as fixed rather than offering an edit the daemon would ignore; a host that stores no credentials says so instead of offering a field.
- Obviously-wrong input is refused before it is sent, and anything typed is wiped when the dialog closes so no secret lingers in a field.
- The enable toggle is independent of the credential: it can be turned on first and starts working once the credential is set.
- Each dialog's one-line description is shared with the onboarding checklist row that opens it, so the two never tell different stories.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
