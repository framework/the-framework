The rules of the `browser` skill [1]: finding and launching a headless Chrome, speaking to the page it shows, reading the page as text and acting on it the way a person would, the screen page [5] a person watches and uses the browser through, the browser's process [4] that keeps all of it between the agent's [2] commands and tells the agent's diary [3] about it, and the `browser` command that finds or starts that process and forwards each command to it. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: the agent runs `browser open localhost:3000`, reads the page it prints, runs `browser type 1 Ada` and `browser click 3`, reads the result, and runs `browser close`; meanwhile a person watching the agent in the dashboard sees the browser live at the row where the agent opened it, and can click and type in it too.

**Business logic story**: each `browser` call is a short process (`cli.ts`). The first `open` in a project starts the browser's process (`host-main.ts`, `host.ts`), detached so it outlives the call, which launches Chrome (`chrome.ts`), connects to its page (`cdp.ts`), and writes the state file [6] the next calls find it by. Each later call posts its command to that process over loopback HTTP with the token [7]; the process acts on the page (`page.ts`) and answers the page as text. The same process serves the screen page (`screen.ts`) at an address that carries the token and, when the agent's environment names a diary, appends a screen line [8] naming that address each time the agent opens a page; the dashboard frames it. The process ends, closing Chrome, on `close`, on the agent ending, on the diary's file going away, after 30 minutes with no command and no input, or when Chrome exits.

## Glossary

[1] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command on the agent's PATH.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] diary: the agent's record of what happened, one JSON line each, in the file `<id>.jsonl` the tool running the agent writes; when the tool keeps one, the agent's environment names it as `AGENT_DIARY`, and the tool appends an `ended` line when the agent ends.
[4] the browser's process: the background process that keeps one project's browser: its Chrome, its connection to the page, and the loopback HTTP server that takes the agent's commands and serves the screen page. Started, detached, by the first `browser open`; one per project.
[5] screen page: the page the browser's process serves at its root: the browser's address bar (back, forward, reload, the address) over a live picture of the page, which takes clicks, scrolling and typing. Its address carries the token.
[6] state file: `skill-browser/<hash>.json` under the machine's temporary directory, the hash taken from the project's root: how the `browser` command finds the project's browser's process (its pid, its port and its token), or learns why it could not start.
[7] token: 32 random hexadecimal characters the browser's process draws when it starts; every request to it must carry it, in the address's `t` parameter or the `x-browser-token` header.
[8] screen line: the diary line `{"kind":"screen","url":<the screen page's address>,"label":<what it shows>}` the browser's process appends when the agent opens a page, and the same with `"ended":true` when the browser goes away; the dashboard frames the newest open one live in the agent's transcript.

## Business logic — TL;DR

- **Chrome** (`chrome.ts`) - which Chrome to run, headless on a throwaway profile with its debugging port on loopback only, and how it is launched and closed.
- **Speaking to the page** (`cdp.ts`) - the page the agent is on (the first page Chrome lists) and one DevTools connection to it, reached only from the browser's process.
- **Reading and acting on the page** (`page.ts`) - the page as title, address, text and numbered elements; opening an address, clicking, typing, pressing a key, a screenshot and a script, each waiting for the page to settle.
- **The screen page** (`screen.ts`) - what a person's clicks, scrolling, typing and address bar become, only the input it knows passing on; the live picture as a stream of JPEG frames.
- **The browser's process** (`host.ts`, `host-main.ts`) - its token-guarded loopback server, the agent's commands, the screen lines in the diary, and the five ways it ends.
- **The `browser` command** (`cli.ts`, `cli.test.ts`) - the eight commands, finding the project's browser's process by its state file or starting it on `open`, forwarding the command, and the exit codes.
- **The entry point** (`index.ts`) - re-exports the command's runner and names, and the screen line's shape.
