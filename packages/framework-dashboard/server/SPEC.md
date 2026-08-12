The dashboard's entire wire surface, holding no logic of its own: each file only names its calls and hands through the real implementations from the framework, so the daemon serves them in-process against the very files it writes.

## TLDR

- A file's path is the contract: it is baked into every call the browser makes, and the daemon answers under exactly that path — so moving or renaming a file here silently disconnects the dashboard from the daemon.
- The files split by concern: steering sessions, the live event stream, everything the UI reads, projects, preferences, usage and automation, and saved-device health.
- Under the plain dev server there is no daemon behind the calls: reads still work, but daemon-only writes report themselves unavailable; a test guards the one source shape that used to break every call in development.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
