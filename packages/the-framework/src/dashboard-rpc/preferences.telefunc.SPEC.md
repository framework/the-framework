Reading and saving the user's settings: the dashboard preferences, a project's shared presets, the editor picker, and the Discord credentials.

## TLDR

- Settings live with the dashboard, not the browser, so they survive restarts and follow the user across tabs. A write that fails answers with the reason rather than rejecting, so the client renders it instead of losing the save.
- A save can merge only the keys a tab changed and hand back what is now stored, so a stale tab converges instead of reverting settings it never touched.
- A project's shared presets are committed into the repo itself, so they travel with the team rather than with one user.
- Discord credentials are write-only: the browser can set them and learn that they exist (and where each came from), never read a value back; a save applies live, so the bot connects without a restart.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
