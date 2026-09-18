Keeps the one file The Framework owns for the user, the registry [1] at `~/.the-framework.json`: the projects the user registered, the preferences [2] behind the dashboard's Settings [3] page, the daemon token that authenticates a dashboard exposed to the network, and the Discord webhook. Every read forgives a damaged or hand-edited file; every write is validated, atomic, owner-only and serialized with the other writes.

## Context

**User story**: the user runs `the-framework` inside a repository, and that repository is a project of the dashboard from then on. The user changes a setting on Settings [3] and finds it unchanged after restarting the daemon. On a second machine nothing carries over: the file is per machine and the user's to re-create there.

**Problem**: the file is written by the daemon from several places at once, written by the browser through Settings, and open to hand edits. So nothing it holds is trusted on read, a write must never leave a half-written file behind, and two writes must never lose each other's changes.

## Glossary

[1] registry: `~/.the-framework.json`, the file that keeps the preferences [2] and also lists the projects.
[2] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[3] Settings: the settings page.
[4] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[5] the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it.
[6] the Overview: the dashboard's cross-project page at `/`.
[7] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **Where the file lives** - one file, under `$XDG_CONFIG_HOME` when that is set, else dotted under `$HOME`.
- **A project's id** - derived from the project's absolute path: its folder name made URL-safe plus a short hash of the whole path, stable forever.
- **Registering a project** - by normalized absolute path, once: a path already registered keeps its record and its registration time.
- **Reading forgivingly** - a missing, unreadable or malformed file reads as an empty registry, and every value read is validated.
- **The on/off preferences** - each kept only as a true or false, each with its own meaning when absent.
- **The choice preferences** - the model, the driver, the editor and the theme, each constrained to the values the dashboard offers.
- **The list preference** - the custom presets, trimmed, bounded and cleared when empty.
- **Unknown keys are dropped, never migrated** - a key this version does not know is dropped on read and never written back.
- **Saving preferences: replace or patch** - a save replaces the block, a patch merges only the keys it names; blank clears; the dashboard's store tells the daemon which keys were written.
- **Atomic, owner-only, serialized writes** - written to a temporary file with owner-only permission and renamed over the real one, one mutation after another.
- **The daemon token** - created once, on demand, only for a daemon bound to a non-loopback address, and reused after.
- **Third-party credentials** - the Discord webhook, kept beside the token, never in the preferences, patched key by key and cleared with `null`.

## Business logic

### Where the file lives

#### Context

See `## Context`.

#### Business logic

The registry [1] is a single file, never a directory. It is `$XDG_CONFIG_HOME/the-framework.json` when that environment variable is set to a non-empty value, else `$HOME/.the-framework.json`. Its parent directory is created on the first write.

### A project's id

#### Context

**User story**: every dashboard URL of a project carries the project's id, and two repositories whose folders share a name must still be told apart.

#### Business logic

A project's id is derived from its absolute path and never changes: the folder's name in lowercase, with every character outside `a-z`, `0-9` and `-` replaced by `-`, followed by `-` and a short hash of the whole path rendered in base 36. The same path always yields the same id, two repositories both named `app` in different places get different ids, and an id is always safe in a URL.

### Registering a project

#### Context

**User story**: running `the-framework` inside a repository registers it; running it again does not register it twice.

#### Business logic

A project is registered by path. The path is first made absolute and normalized, so a trailing slash or a `..` segment does not make a different project. A path already registered returns its existing record untouched, registration time included. Otherwise a record with the id, the absolute path and the registration time given is appended, and the file is written back with the preferences [2], the token and the credentials preserved.

### Reading forgivingly

#### Context

**Problem**: a damaged file must not take the daemon down or put the dashboard into an error, and a hand edit must not smuggle junk into the daemon.

#### Business logic

A file that is missing, unreadable, not JSON, or whose top level is not an object (an array, a number, a bare string) reads as an empty registry: no projects, no preferences [2], no token, no credentials. Reading never fails. Only well-formed project records are kept (an id, a path and a registration time, all text); records are deduplicated by normalized path, the first one winning. The preferences, the token and the credentials each go through the validation described below, so an unknown or wrongly typed value never reaches the daemon.

### The on/off preferences

#### Context

**User story**: the toggles on Settings [3].

#### Business logic

Each of these keys of the preferences [2] is kept only when its value is a true or a false; anything else is dropped. Absent means the default given here:

- `notifyBrowser`: notify in the browser; absent means on.
- `notifyDiscord`: notify on Discord too; absent means off, because Discord reaches the user when no dashboard is open, and it also needs the webhook described below.
- `notifyHumanIntervention`: the "needs you" category, an intervention [4]; absent means on, the baseline The Framework leans on.
- `notifyNewActivity`: the activity category, an agent started or finished; absent means off. The two categories compose with the two methods above: a notification is delivered by a method only when both its category and that method are on.
- `bridge`: switch the bridge [5] on; absent means off, because it opens the daemon's one route reachable from another origin.
- `bridgeBrowser`: let the daemon run its own bridge browser; absent means off, because it downloads a browser and keeps a signed-in claude.ai session on disk. It only matters with `bridge` on.
- `onboardingDismissed`: the Onboarding checklist on the Overview [6] has been dismissed; absent means show it, and dismissing hides it only there, the same checklist staying available on Settings.
- `postMergeCleanup`: follow an agent started from the launcher, in a project that has the `post-merge-cleanup` command, with a fresh agent running that command on the first one's branch before its pull request merges; the default of the launcher's "Post-merge cleanup" box, which writes it too; absent means off.

### The choice preferences

#### Context

**Problem**: a value outside the set the dashboard offers must not reach the project's start hook, and through it the coding agent's [7] command line, where it would fail the agent on a word nobody chose.

#### Business logic

- `model`: the model agents run on, free text, trimmed; a blank value is dropped, and so is the word "Default" in any casing, which is a picker label and not a model. It is handed to the project's start hook. Absent means the hook's own default.
- `driver`: `claude-code` or `codex`; anything else is dropped, the old name `claude` included. Absent means the project's start hook decides.
- `editor`: the command "Open in editor" runs (`code`, `cursor`, `zed`, ...), trimmed and cut to 100 characters; blank is dropped. Absent means the `FRAMEWORK_EDITOR` environment variable, then `code`.
- `theme`: `system`, `light` or `dark`; anything else is dropped. Absent means `system`, following the operating system.

### The list preference

#### Context

**Problem**: a list must stay bounded so a hand-edited or hostile file cannot grow without limit, and a junk entry must be dropped on its own rather than costing the whole list.

#### Business logic

- `customPresets`: the presets the user saved. Each needs an `id`, a `label` and a `prompt`, all text and non-blank after trimming; the label is cut to 80 characters and the prompt to 20,000; an entry with a duplicate id, or malformed in any way, is skipped rather than failing the read; at most 30 are kept, in file order. When none survive, the key is left out of the file.

### Unknown keys are dropped, never migrated

#### Context

**Problem**: a renamed or removed setting must leave nothing behind, neither a fallback to its old name nor a notice about what was dropped (the zero-migration rule in `MEMORY.md`).

#### Business logic

A key this version does not know, whether a hand edit added it or an earlier version wrote it under a spelling since renamed, is dropped on read and never written back. A file written under an older shape is rewritten by hand, not by code. The same rule reads the whole file: a file whose top level is a bare list of projects is a shape this version does not write, and it reads as empty.

### Saving preferences: replace or patch

#### Context

**User story**: the user changes one setting in one dashboard tab while another tab has been open for hours; the old tab's next save must not revert the change.

#### Business logic

Preferences [2] are saved in one of two ways. A save replaces the whole block with the one given, validated as above. A patch merges only the keys it names over the stored block, validates the merged result with the same rules, writes it and returns what was stored, so a write touches only what it names. Clearing needs no special value: a blank string or an empty list is dropped by validation, which is how "Open in editor" is reset and the last custom preset removed. Either way the project list, the token and the credentials are preserved. The store handed to the dashboard tells its listener which keys the caller wrote, not the merged result, so the daemon can tell "this write switched a setting on" from "it was already on and something else changed"; the listener runs after the write has landed, and a listener that fails does not fail the save.

### Atomic, owner-only, serialized writes

#### Context

**Problem**: a direct write truncates the file before filling it, so a crash or a full disk mid-write would leave a half file, which reads as an empty registry and silently loses every project and setting. The file holds a token and a credential, so a write with default permissions in a shared home would hand them to every other account on the machine. And one daemon writes the file from several places at once.

#### Business logic

The file is written as indented JSON; the token and the credentials are written only when present. Each write goes to a temporary file beside the real one (the file's name plus the writing process's id and `.tmp`), has its permission narrowed to owner read and write only (`0600`) while it is still the temporary file, and is then renamed over the real file. A reader therefore sees the whole old file or the whole new one, never a mixture, and the real path is never readable by others. A write that fails part way damages only the temporary file, which is left behind. The permission narrowing is best-effort: a filesystem that cannot express it (Windows, a FAT volume) still gets the write. Every mutation of the file (registering a project, saving or patching preferences [2], creating the token, saving a credential) runs after the previous one has finished, so a write is never computed from a read taken before another write landed; a mutation that fails hands its error to its caller and does not block the next.

### The daemon token

#### Context

**User story**: the user starts the CLI with `--host` on a non-loopback address; the printed URL carries a token, and every request without it is refused.

#### Business logic

The token is 32 random bytes rendered as base64url, so it drops into a `?token=` query string without encoding. It is created only when the daemon asks for it on a non-loopback bind, persisted at the top level of the file, never inside the preferences [2] (which are shipped to the browser), and reused on every later request. So a loopback-only machine never grows one, a process that only reads the token (to print the reachable URL) never creates one, and two daemons asking at once settle on one token, not two. On read the token is kept only when it is non-empty text; a number, an empty string, `null` or an object written by hand reads as no token.

### Third-party credentials

#### Context

**User story**: the user pastes a Discord webhook on Settings [3] and later clears it with a Clear button; the dashboard shows whether one is set, never the value.

#### Business logic

The file's `secrets` block holds the credentials the daemon needs to reach a third party, today one: `discordWebhook`, where Discord notifications are posted (the `DISCORD_WEBHOOK` environment variable takes precedence over it when set). They sit at the top level beside the token, never inside the preferences [2], so neither the browser bundle nor any per-project setting can carry them, and only daemon-side services read a value back. Saving is a patch: a key not mentioned stays as it was; `null` or a blank value clears the key; clearing the last one removes the block from the file. Values are trimmed and cut to 500 characters; a key that is not a known credential, or a value that is not text, is dropped on read.
