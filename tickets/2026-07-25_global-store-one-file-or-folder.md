Priority: 2
Topics: [question, the-framework]
GitHub: [#1151](https://github.com/gemstack-land/the-framework/issues/1151)

# Global store: one file or a folder?

## TLDR

Keep the global store as one file (`$XDG_CONFIG_HOME/the-framework.json` else `$HOME/.the-framework.json`, holding projects/preferences/projectPreferences/daemonToken/secrets, 0600, atomic temp-file+rename) or move to a `the-framework/` folder of several files? **Recommendation: keep the file** — the store is ~2 KB, nothing is straining, and the atomic single-rename commit beats tidiness; revisit when something global and per-item needs disk. Two fixes worth doing either way: honor the XDG spec default (`~/.config` even when `XDG_CONFIG_HOME` is unset, plus a migration read), and cover the sprawl (the store is really two `$HOME` entries: the registry and `.the-framework-daemon.json`).

## Why it matters

This is a durability/permissions trade-off with user-visible consequences: one file means everything is 0600 because two of five keys are secret and people looking for a folder don't find it; a folder means per-file permissions and room to grow but loses cross-file transactionality ("projects written, preferences not" becomes reachable) and forces a migration for every install. The XDG-default bug is why people look in `~/.config` and miss the store today.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1151](https://github.com/gemstack-land/the-framework/issues/1151), created 2026-07-25, labels: `question`, `priority: low`, `the-framework ♻️`, 1 comment.

### Original description

## Today

The global store is one file, decided on #390:

- `$XDG_CONFIG_HOME/the-framework.json`, else `$HOME/.the-framework.json`
- holds `projects`, `preferences`, `projectPreferences` (#840), `daemonToken` (#1051), `secrets` (#1095)
- mode 0600, written temp-file + rename, so it commits atomically

One more entry sits beside it in `$HOME`, resolved the same way:

- `.the-framework-daemon.json` (pid/port/url, #393)

## The question

Keep one file, or move to a `the-framework/` folder holding several files?

## Option A: keep one file (today)

| Pros | Cons |
| --- | --- |
| One rename commits the whole store, no partial states | Everything is 0600 because 2 of the 5 keys are secret |
| Fits the `.bashrc` framing from #390 | Anything not JSON-shaped becomes a sibling |
| No migration | People look for a folder and do not find it |

## Option B: a folder

| Pros | Cons |
| --- | --- |
| Per-file permissions: `secrets.json` 0600, the rest readable | No cross-file transaction, so "projects written, preferences not" becomes reachable |
| One entry in `$HOME` instead of two, a home for the sibling | Migration for every existing install |
| Room to grow: caches, per-run archives, device certs | Undoes #390 for reasons #390 did not have |

## Recommendation

Keep the file. The store is ~2 KB, nothing is straining, and the atomic write is worth more than tidiness. Revisit when something global and per-item needs disk.

## Two things worth fixing either way

1. **The XDG default.** We use `~/.config` only when `XDG_CONFIG_HOME` is set. The spec default is `$HOME/.config` when it is unset, which is why people look there and miss it. Honoring it is a small change in `registryPath()` plus a migration read.
2. **The sprawl.** "A single file" is not quite true: two entries. Whatever we decide should cover both, not just the registry.

### Notes from the GitHub thread

- Maintainer pointer: "How about this? — https://github.com/gemstack-land/the-framework/issues/410#issue-4865712231".
