The `browser` skill [1]: a headless Chrome of the agent's [2] own, on an empty profile, that the agent drives from the shell with the `browser` command (`open`, `read`, `click`, `type`, `press`, `screenshot`, `eval`, `close`), reading each page back as text with its clickable and typeable elements numbered. One background process per project, the browser's process [4], keeps the browser between commands and serves the screen page [5], a live view of the browser a person can click and type in. When the agent's environment names its diary [3], opening a page appends a screen line [6] there, which is how the dashboard shows the browser live in the agent's transcript, where the agent used it; the browser closes on `close`, when the agent ends, and after 30 minutes unused. `SKILL.md` is what the agent reads; `package.json`, the `tsconfig*.json` files and the ignored build output (`dist/`, `dist-test/`) carry no business logic. The package depends on nothing but Node (22.12 or later) and a Chrome on the machine; it keeps nothing on the `agent-data` branch, and the product does not depend on it.

## Context

**User story**: an agent changes a web app and checks that the change works: it opens the app's address, reads the page, types into a field, clicks a button and reads the result, and closes the browser. A person watching the agent in the dashboard sees that browser live at the row where the agent opened it, and can click and type in it too.

**Problem**: the agent works from a shell, one short command at a time, while a browser has to stay open between commands and a person has to be able to watch it; and the browser must never show the agent anything of the person at the machine (no window on their screen, none of their logins).

## Glossary

[1] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command on the agent's PATH.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] diary: the agent's record of what happened, one JSON line each, in the file `<id>.jsonl` the tool running the agent writes; when the tool keeps one, the agent's environment names it as `AGENT_DIARY`, and the tool appends an `ended` line when the agent ends.
[4] the browser's process: the background process that keeps one project's browser: its Chrome, its connection to the page, and the loopback HTTP server that takes the agent's commands and serves the screen page. Started, detached, by the first `browser open`; one per project.
[5] screen page: the page the browser's process serves at its root: the browser's address bar (back, forward, reload, the address) over a live picture of the page, which takes clicks, scrolling and typing. Its address carries the process's token.
[6] screen line: the diary line `{"kind":"screen","url":<the screen page's address>,"label":<what it shows>}` the browser's process appends when the agent opens a page, and the same with `"ended":true` when the browser goes away; the dashboard frames the newest open one live in the agent's transcript.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - the eight commands, how a page reads back, the exit codes, that a person may be using the same browser, and to close it when done.
- **The executable** (`bin/`) - the `browser` command on the agent's PATH, handing the shell to the command's rules.
- **The browser and its commands** (`src/`) - finding the Chrome and launching it headless, speaking to its page, reading and acting on the page, the screen page, the browser's process with its screen lines and its ways to end, and the short-lived command that finds or starts that process and forwards to it.
