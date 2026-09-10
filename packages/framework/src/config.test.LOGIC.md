What the tests cover:

- **The keys the repo file speaks** - `vanilla` and `transparent` are read as booleans, together or alone, and a non-boolean value for either is refused by name; `handoff` is read as a rung (`local`, `merge`), and a name nobody defines or a bare `true` is refused with the list of the four rungs.
- **Only the current spellings** - retired keys (`autoPushBranch`, `autoOpenPr`, `autoMerge`, `antiLazyPill`, `preset`, `event`) are unknown keys and ignored, with no migration.
- **Empty and malformed documents** - an empty document or one holding only a comment yields no defaults; a list at the top level is refused as not a map; a mistyped field is refused.
- **Reading from a directory** - `the-framework.yml` in the directory is read; a directory without the file yields no defaults; a malformed file yields no defaults and a warning that starts with "ignoring the-framework.yml".
