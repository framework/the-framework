Reading and saving the user's settings: the dashboard preferences, a project's shared presets, the editor picker, and the Discord credentials.

## User Stories

- The user changes a setting once and it sticks — across tabs, reloads, and daemon restarts.
- The user saves a preset into the repo and the whole team gets it.
- The user picks a preferred editor from the ones actually installed on the server.
- The user sets the Discord credentials from the settings page and the bot connects right away.

## Flows

- Settings live on the daemon, not in the browser, so they survive restarts and follow the user across tabs. A write that fails answers with the reason rather than rejecting, so the client renders it instead of losing the save.
- A save can merge only the keys a tab changed and hand back what is now stored, so a stale tab converges instead of reverting settings it never touched.
- A project's shared presets are saved into the repo itself, so they travel with the team rather than with one user.
- The editor picker lists the editors actually installed on this server.
- Discord credentials are write-only: the browser can set them and learn that they exist (and where each came from), never read a value back; a save applies live, so the bot connects without a restart.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
