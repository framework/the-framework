What the tests cover: a project's display name is the last segment of its repo path, alongside its registry id and path; its last activity is the newest of its agents, and a project with no agents reports no activity at all; activation reflects whether the repo still carries The Framework's marker; every read is forgiving, so a failing activation check or agent read yields an inactive project with no activity instead of an error; the summary carries the repo's committed `the-framework.yml` defaults so the launcher can show what an agent will resolve to, carries nothing when the repo sets nothing, and survives intact when that file cannot be read at all.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
