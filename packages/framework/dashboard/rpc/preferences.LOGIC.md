The browser's typed stubs for the preferences [1] that Settings [2] and the launcher [3] read and save, for a project's shared custom presets, for the editors installed on the daemon's machine, and for the Discord credentials the daemon holds: one stub per call, addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for it, taken from `src/dashboard-rpc/preferences.ts`. A call the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking the page at runtime. The stubs add no rule of their own: what each call answers and refuses is the daemon's logic in `src/dashboard-rpc/preferences.ts`; only the calls' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] Settings: the settings page.
[3] launcher: the Start form on a project's own page (the project home).

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that call, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a save that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The user's preferences** - read the stored preferences [1] (empty when the daemon cannot read them); replace them whole; or send only the keys the user changed and receive what is now stored, so a tab that loaded long ago adopts the stored truth instead of reverting settings it never touched. A write that fails answers "failed to save preferences" rather than a thrown error, so the page can show it.
- **A project's shared custom presets** - read and save the custom presets committed in the project's own `.the-framework/`, which travel with the repository for the whole team; an unknown project reads as no presets and refuses a save with "unknown project".
- **Installed editors** - the editors found on the daemon's machine, for the "Preferred editor" picker; none when detection fails.
- **Notification channels and the Discord credentials** - whether the daemon holds the Discord credentials delivery needs, where each came from, and whether they can be set from the dashboard, reported as presence only and never as values; and store or clear those credentials, write-only, applied by the daemon at once so the bot connects without a restart.
