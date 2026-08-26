Tells whether the extension's own files changed on disk since the service worker started: the rule the worker uses to reload the extension by itself, shared with the offline check harness.

## User story

A developer edits the extension in its checkout. They want the running extension to pick the change up on its own, instead of every edit needing a click on chrome://extensions.

## Glossary

- **fingerprint** — the hash of each of the extension's files, taken together; two fingerprints differ exactly when some file's text differs.

## Business logic — TL;DR

- **Every file Chrome loads is watched** - the manifest, the service worker and the scripts it imports, the content script, and the options page and its script.
- **A difference in any watched file is a change** - reported by file name, in a fixed order.
- **A file that cannot be read is never a change** - the fingerprint fails as a whole, and the caller treats that as nothing changed.

## Business logic

### Which files count

#### User story

See `## User story`.

#### Business logic

The watched files are exactly the ones Chrome loads for the extension: `manifest.json`, the service worker and the scripts it imports, the content script, and the options page and its script. A fingerprint is the hash of each of them, read through whatever reader the caller supplies. Comparing two fingerprints names the files whose hash differs, in the watched order, and names nothing when none does.

#### Rationale

A file Chrome does not load cannot change what the extension does, so it earns no reload; a file it does load and this did not watch would be the one edit that still needed the click.

### A file that cannot be read is never a change

#### User story

See `## User story`.

#### Business logic

When any watched file cannot be read, the fingerprint fails instead of being taken with that file counted as changed.

#### Rationale

A read can fail for a moment — a file being rewritten, a checkout mid-switch. Taking that for a change would reload the extension, whose new worker would read the file fine and find nothing to reload for, or fail again and reload again: a loop for nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
