The warning banner at the top of a project's page, listing every project error the daemon currently finds with that project.

## Glossary

- **project error** - a condition the daemon has found broken about a project and keeps recorded until the condition is gone. Today the only kind is a data branch that cannot sync, headlined "The data branch is not syncing".

## Business logic — TL;DR

- **Only real, current problems are shown** - the banner shows exactly the project errors the daemon currently records; a project with none has no banner.
- **Nothing to dismiss** - the banner cannot be closed and remembers nothing of its own. It disappears when the daemon clears the condition, so the only way to be rid of it is to fix what it names.
- **A headline plus the raw detail** - each project error shows a plain-language headline for its kind, followed by the underlying failure message.
- **Since when** - each project error states how long it has been failing, so a week-old failure does not read like a blip that will pass on its own.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
