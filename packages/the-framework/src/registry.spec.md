The per-machine home file (`~/.the-framework.json`, mode 0600): registered projects, global and per-project preferences, custom presets, the daemon token, and Discord credentials.

## Decisions

- `.bashrc`-style — per machine, never synced. Project-overridable preference keys live here rather than in the committed `the-framework.yml`, because keys like `model`/`agent` name what *this machine* runs and must not be imposed on everyone who clones the repo.
- Preferences resolve project-over-global, and only for the keys a project is allowed to override; sanitizers run on every read.

## Facts

- A project id hashes the **resolved** path, so callers must resolve before deriving an id.
- Also owns the scratch path where a project-less "topic" run lives before it binds to a project, and path validation before anything lands in the home file.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
