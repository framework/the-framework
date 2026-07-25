---
"@gemstack/the-framework": minor
---

fix(the-framework): carry the ticket and backlog format specs in the run's system channel (#1163): both were pointed at as `node_modules/@gemstack/the-framework/prompts/*.md`, a path that only resolves when the framework is a root dependency of the repo it works on, so the agent was told to follow a format it could not open. The spec still ships with the package and is never written into the user's repo (#674), it is just handed over rather than left to be found. The two unused `TICKETING_FORMAT_FILE` / `TODO_FORMAT_FILE` path constants go with it, along with the `files` entries that published the specs for them.
