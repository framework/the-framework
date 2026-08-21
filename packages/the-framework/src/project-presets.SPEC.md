Project-shared custom presets: saved into the repo rather than the user's home file, so a team's presets travel with the code and everyone who clones it gets them.

## User Stories

- The user saves a custom preset into the repo, and every teammate who clones the repo gets it.

## Flows

- Same shape and same sanitizer as the personal presets, so the dashboard renders both alike and a hand-edited or hostile file is cleaned on read and on write.
- Saving also un-ignores the file in the framework directory's gitignore.
- Reading is forgiving: a missing or malformed file means no presets, never an error; removing every preset keeps the file so the sharing setup stays in place.

## Rationales

- The framework directory's gitignore hides everything by default, so without the un-ignore line git would never see the presets and they could not be shared.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
