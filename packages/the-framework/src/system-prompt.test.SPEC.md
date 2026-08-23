What the tests cover: the composition of an agent's system channel and the reading of the user's `SYSTEM.md`.

- The context docs are exactly the expected set (knowledge-base docs, `GOAL.md`, `BUSINESS_LOGIC.md`, market research, the catch-all, `tickets/**.md`, `TODO_AGENTS.md`); the business-knowledge subset the agent updates at merge excludes the read-only pointers; the two format-bearing bullets name a section of the channel itself, and no doc may point into `node_modules/`.
- `SYSTEM.md` is read and trimmed; absent or whitespace-only reads as no user prompt.
- The built-in prompt template carries its section headings verbatim, names `TODO_AGENTS.md` via the shared constant, tells the agent its working directory is the whole of its workspace, no longer asks for the retired analysis artifact or carries pre-rewrite headings, and has exactly one variable slot (the user's prompt).
- Rendering splits the system and user halves, fully renders the system half, and is not confused by a user prompt that itself contains the boundary heading.
- The channel carries the Ticketing format, backlog format, and data branch protocol specs below the bullets that name them; vanilla drops them along with the docs and the built-in prompt, keeps the user's own dirs and prompt, and an empty vanilla block is truly empty.
- Composition order and exactness: context (user dirs first, docs after), format specs, built-in prompt, user prompt, then the await and signal protocols — and nothing else, whatever the options; the signal protocol is always last.
- The browser protocol appears only when the agent has a browser; the hands-off protocol (land everything) appears only for a hands-off agent, whose await protocol is the same one every agent gets. A local agent gets neither. Both survive vanilla and none survives transparent.
- Vanilla keeps the emit protocols; transparent empties the whole channel regardless of every other option.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
