Builds the snapshot of a project's live session that chat routing decides against.

## TLDR

- The parked question's options are not on the session's status snapshot, so answering by number from chat means reading them back out of the session's event log — through the store's own reader, so this surface cannot drift from its parsing rules.
- A question already answered elsewhere is closed to chat, so a reply cannot answer something the dashboard settled.
- Accepted limit: chat models one live session per project and always picks the newest, because the bot has no way yet to let the user choose between several.
- Forgiving throughout — unreadable session state must never break the chat surface.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
