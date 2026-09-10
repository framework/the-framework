Keeps a project's shared custom presets [1], the ones saved into the repository so they travel with the code and reach everyone who clones it, in `.the-framework/custom-presets.json` as a plain list of entries with an id, a label and a prompt: the same shape and the same sanitizer as the user's private custom presets in the registry [2], so the dashboard shows both tiers from one shape. Reading never fails, a missing or malformed file being no presets; writing sanitizes first and makes sure git tracks the file by un-ignoring it in `.the-framework/.gitignore`.

## Context

**User story**: the user saves a custom preset from the composer either privately, so it follows the person across every project and stays in the registry [2] in the home directory, or for the project, so it lands in the repository and everyone who clones the repository gets it. The presets menu on project home offers both.

**Problem**: `.the-framework/` ignores everything but a short allowlist, so without an explicit un-ignore line git would never see the shared presets and they could not be shared.

## Glossary

[1] custom preset: A preset the user saved, as opposed to the built-in ones.
[2] registry: `~/.the-framework.json`, which keeps the user's preferences and lists the projects.

## Business logic — TL;DR

- **Where they live** - the project's shared custom presets are the list in `.the-framework/custom-presets.json`, committed with the code; the user's private ones live in the registry.
- **Reading never fails** - a missing, unreadable or malformed file reads as no presets, and every entry passes the sanitizer, so a hand-edited or hostile entry is dropped rather than shown.
- **Writing sanitizes and keeps git tracking the file** - the list is sanitized and written pretty-printed, the un-ignore line is added to `.the-framework/.gitignore` once, and removing every preset writes an empty list rather than deleting the file.

## Business logic

### Where they live

#### Context

See `## Context`.

#### Business logic

A project's shared custom presets [1] are one JSON list at `.the-framework/custom-presets.json` under the project's checkout. Each entry has an id, a label and a prompt, exactly the shape of a private custom preset in the registry [2], so one type and one sanitizer serve both files.

### Reading never fails

#### Context

**Problem**: the file is committed, so anyone with write access to the repository, or a hand edit, can put anything in it; the dashboard must never break over it.

#### Business logic

A file that is missing or cannot be read yields no presets; so does one that is not valid JSON. What parses is passed through the sanitizer whose rules live in `registry.ts`: only entries with a string id, label and prompt survive, trimmed, with the label cut at 80 characters and the prompt at 20,000, blank values and duplicate ids dropped, and at most 30 presets kept. Nothing about a read ever throws.

### Writing sanitizes and keeps git tracking the file

#### Context

**Problem**: `.the-framework/.gitignore` ignores everything (`*`) and un-ignores only a short allowlist, so a file written there is invisible to git unless it is un-ignored by name.

#### Business logic

A write creates `.the-framework/` if needed, then makes sure `.the-framework/.gitignore` contains the line `!custom-presets.json`: the line is appended once, on its own line, and never duplicated on later saves. When there is no ignore file yet, as in a directory not yet activated, the bare un-ignore line is written on its own; it only takes effect once activation adds the rest, and does no harm before. The list is then sanitized by the same rules as on read and written as pretty-printed JSON with a trailing newline. Removing every preset writes an empty list rather than deleting the file, so the un-ignore line stays in place for the next save.
