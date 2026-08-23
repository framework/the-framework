Stores a project's shared custom presets in the repo itself, at `.the-framework/custom-presets.json`, so they are committed alongside the code and everyone who clones the repo gets them.

## Business logic — TL;DR

- **Two tiers of custom presets, one shape** - a project-tier custom preset lives in the repo and travels with the code; a user-tier one lives in the user's registry and follows the person privately across every project. Both use the same preset shape and pass the same validation, so the dashboard treats them alike.
- **Reading never fails** - a missing, unreadable or malformed presets file yields no presets instead of an error, and any hand-edited or malformed entry inside a readable file is dropped.
- **Saving keeps the file committable** - every save validates the presets before writing, and makes sure `.the-framework/.gitignore` un-ignores the presets file so git actually tracks it. Deleting the last preset writes an empty list rather than removing the file.

## Business logic

### Two tiers of custom presets, one shape

#### User story

A user builds a canned prompt they keep reusing. Some are personal habits that should follow them everywhere and stay out of the repo; others are conventions the whole team working on this repo should get automatically. The project tier is the "share your presets" half: saved into the repo, committed, and present for anyone who clones it.

#### Business logic

A project's shared custom presets are held as a list in a single committed file under the project's `.the-framework/` directory. The list uses the same preset shape as the user's own custom presets, and the same validation guards both, so a preset can be presented identically no matter which tier it came from.

### Reading never fails

#### User story

The presets file is committed, which means it can be edited by hand, hit a merge conflict, or simply not exist yet. None of that may stop a project from loading.

#### Business logic

If the file is absent or cannot be read, the project has no shared custom presets. If its contents are not valid JSON, the same. If it parses but contains entries that are not well-formed presets, those entries are dropped and the rest are kept.

### Saving keeps the file committable

#### User story

The user saves a shared preset from the dashboard and expects it to show up as a change they can commit and push to their team.

#### Business logic

Saving creates the project's `.the-framework/` directory if needed, validates the presets, and writes them as the file's full contents.

Because `.the-framework/` ignores everything by default apart from a short allowlist, saving also appends an un-ignore line for the presets file to that directory's `.gitignore`, unless the line is already present. Without it git would never see the file and the presets could not be shared. If the directory has no `.gitignore` yet — the project is not activated — a bare un-ignore line is written anyway; it has no effect until activation adds the blanket ignore, at which point it starts doing its job.

Removing every preset writes an empty list rather than deleting the file, so the un-ignore line and the tracked file both survive for the next save.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
