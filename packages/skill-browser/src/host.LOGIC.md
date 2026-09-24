The browser's process [1]: started by the first `browser open` in a project, it launches Chrome, keeps the connection to the page the agent [2] is on with the live picture running, serves the agent's commands, one at a time, and the screen page [3] over a token-guarded [4] HTTP server on loopback, writes the screen lines [5] into the agent's diary [6], and ends, closing Chrome, on the first of five events.

## Context

**User story**: the agent runs one short `browser` command after another; between them the browser stays open, on the same page, and a person watching the agent sees it live in the agent's transcript from the row where the agent opened it until it closes.

**Problem**: nobody is guaranteed to run `browser close`: the agent may end, its checkout may be reclaimed, or it may simply forget; a Chrome left running would hold memory and a profile on the machine for good.

## Glossary

[1] the browser's process: the background process that keeps one project's browser: its Chrome, its connection to the page, and the loopback HTTP server that takes the agent's commands and serves the screen page. Started, detached, by the first `browser open`; one per project.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] screen page: the page the browser's process serves at its root: the browser's address bar (back, forward, reload, the address) over a live picture of the page, which takes clicks, scrolling and typing. Its address carries the token.
[4] token: 32 random hexadecimal characters the browser's process draws when it starts; every request to it must carry it, in the address's `t` parameter or the `x-browser-token` header.
[5] screen line: the diary line `{"kind":"screen","url":<the screen page's address>,"label":<what it shows>}` the browser's process appends when the agent opens a page, and the same with `"ended":true` when the browser goes away; the dashboard frames the newest open one live in the agent's transcript.
[6] diary: the agent's record of what happened, one JSON line each, in the file `<id>.jsonl` the tool running the agent writes; when the tool keeps one, the agent's environment names it as `AGENT_DIARY`, and the tool appends an `ended` line when the agent ends.
[7] state file: `skill-browser/<hash>.json` under the machine's temporary directory, the hash taken from the project's root: how the `browser` command finds the project's browser's process (its pid, its port and its token), or learns why it could not start.

## Business logic — TL;DR

- **Starting** - draws the token [4], launches Chrome and connects to its page, listens on `127.0.0.1` at a free port, and only then writes the state file [7] with its pid, port and token (readable by its owner only); a Chrome that cannot start, or shows no page, leaves the error in the state file instead.
- **The page the agent is on, and its live picture** - every command and input first finds the page the agent is on, following a new tab; on a new page it connects, starts a JPEG screencast (quality 60, at most 1280×800) and drops the old connection.
- **The token guards everything** - a request without the token is refused with 403; the screen page, its picture stream and its state are the only reads, the agent's commands and the person's input the only writes.
- **One command at a time, answered within 30 seconds** - a command starts once the one before it has answered; a command that takes longer than 30 seconds is refused, while its work goes on in the page.
- **Dialogs** - an alert, confirm or prompt the page opens is accepted at once, and the next answer to the agent, a refusal included, begins with one `Dialog, accepted:` line per dialog.
- **The agent's commands** - `open`, `read`, `click`, `type`, `press` answer the page as read after the action; `screenshot` the PNG; `eval` the script's JSON; `close` answers "The browser is closed." and then ends; a refusal answers its sentence.
- **The screen lines in the diary** - the diary is the one named in the environment of the command that started the process; every `open` appends a screen line [5] with the screen page's address and "browser · <the page's address>"; when the process ends after at least one, it appends "browser · closed" with `ended`, unless the agent already ended; with no diary, nothing is written.
- **The person's input** - an input from the screen page goes to the page as `screen.ts` maps it; an input it does not know is answered 400.
- **When it ends** - on `close`; on an `ended` line reaching the diary after the process started; on the diary's file going away; after 30 minutes (the caller's figure) with no command and no input; when Chrome exits, or the process is told to stop.
- **Ending** - the viewers' streams and the server closed, the `ended` screen line written when due, Chrome closed and its profile removed, and the state file removed unless a newer browser has already written its own.

## Business logic

### Starting

#### Context

**Business logic story**: `browser open` starts this process detached and waits for the state file [7]; the file appears only once the process can answer, or says why it cannot.

#### Business logic

The process draws a token [4] of 16 random bytes in hexadecimal and launches Chrome by the rules of `chrome.ts`. When Chrome cannot start, the state file holds `{"error": <the sentence>}` and the process ends. It then connects to the page the agent is on; when Chrome shows no page ("the browser has no page open") or the connection fails, Chrome is closed and the state file holds that error. Otherwise it listens on `127.0.0.1` at a port the system picks, the screen page's address becomes `http://127.0.0.1:<port>/?t=<token>`, the diary's current size is noted (see "When it ends"), and the state file is written as `{"pid", "port", "token"}`, readable and writable by its owner only, its directory made when missing and then open to its owner only.

### The page the agent is on, and its live picture

#### Context

**User story**: the agent clicks a link that opens a new tab; its next read is of the new tab, and the person watching sees the new tab.

#### Business logic

Before every command and every input, the page the agent is on is found by the rule of `cdp.ts`; none is refused as "the browser has no page open". The same page, still connected, is kept. A different page is connected to, and on it the process starts a screencast: Chrome sends a JPEG frame at quality 60, at most 1280×800, whenever the page's picture changes; each frame becomes the newest frame, is sent at once to everyone watching the stream, and is acknowledged so Chrome sends the next. The process also listens on it for dialogs (see "Dialogs"). The previous page's connection is then closed. Finding and connecting to the page happens one caller at a time: a command and a person's input arriving together never connect to a new tab twice; the second waits for the first to finish, then finds the page again. While anyone watches, the newest frame is also sent again every second, because a still page sends no frames and a moving image in a browser paints a frame only once the next one begins.

### The token guards everything

#### Context

**Problem**: the server is on loopback, but any page in any browser on the machine can make requests to loopback; only a holder of the token may see or drive the browser.

#### Business logic

Every request must carry the token [4] in the `t` parameter of its address or in the `x-browser-token` header; any other is answered 403 with nothing. With the token:

- `GET /` answers the screen page [3], never cached.
- `GET /stream` answers the live picture as a never-ending `multipart/x-mixed-replace` stream, starting with the newest frame when there is one; the viewer is dropped when it disconnects.
- `GET /state` answers `{"url", "title"}` of the page the agent is on, empty strings when there is none.
- `POST /input` takes one input from the screen page (see "The person's input").
- `POST /command` takes one of the agent's commands and answers `{"ok": true, "output", "png"?}` or `{"ok": false, "reason"}`, always with 200.
- Any other request is answered 404. A body is JSON, at most 1,000,000 characters; a larger one fails the request with 500 "request too large", and one that is not JSON reads as nothing. An error while serving answers 500 with its message.

### One command at a time, answered within 30 seconds

#### Context

**Problem**: two commands at once on one page would cancel each other's loads (two `open`s from two shells, say); and a page that never finishes (a script stuck in a loop) must not leave the agent waiting for good.

#### Business logic

The agent's commands form a queue: each starts only once the one before it has answered. A command not done within 30 seconds is answered as a refusal, "the page did not answer within 30s: read it again, or close the browser and open it again"; the work it started is not stopped and goes on in the page, and the next command in the queue starts at once. The person's input does not wait in this queue.

### Dialogs

#### Context

**Problem**: an alert, confirm or prompt blocks the page until someone answers it, and the agent cannot see it.

#### Business logic

Every dialog the page the agent is on opens is accepted as soon as it opens: an alert dismissed, a confirm answered OK, a prompt answered with its default text. Each is remembered as its type and its message in quotes (`confirm "sure?"`). The next answer to a command begins with one line per dialog remembered, `Dialog, accepted: <type> "<message>"`, in the order they opened: on a success followed by a blank line and the answer's own output, on a refusal followed by the reason. The remembered dialogs are cleared with every answer.

### The agent's commands

#### Context

See `## Context`.

#### Business logic

`click` and `type` take an element number, which must be a whole number of at least 1; anything else is refused: "<argument> is not an element number: use the number in brackets from the last read" ("(nothing)" when the argument is missing).

- `open <address>` opens the address by the rules of `page.ts`, reads the page, writes a screen line [5] (see "The screen lines in the diary") and answers the read.
- `read` answers the page as read.
- `click <n>`, `type <n> <text>` and `press <key>` act by the rules of `page.ts`, then read the page the agent is on afterwards, which may be a new tab, and answer that.
- `screenshot` answers the PNG, as base64, with an empty output.
- `eval <script>` answers the script's value as JSON.
- `close` answers "The browser is closed." and ends the process right after the answer is sent.

Any failure (a refusal from `page.ts`, the page closing, Chrome's own error) answers `{"ok": false}` with its sentence as the reason.

### The screen lines in the diary

#### Context

**User story**: the person watching sees the browser live at the row where the agent opened it, and sees it go when the browser closes.

**Business logic story**: the process learns the diary's path from `AGENT_DIARY` in the environment of the `browser open` that started it (see `host-main.ts`), and keeps that diary for its whole life: a later command run from another environment, another agent's or a person's shell in the same project, reuses the browser and its `open`s write into that first diary, or into none when the browser was started with no diary; the dashboard reads the diary and frames the newest open screen line at an address (the rule of the framework's transcript).

#### Business logic

After every successful `open`, the process appends a screen line [5] to the diary [6]: the screen page's address and the label "browser · <the address the read printed>" (the address the agent gave when the read has none). Every `open` appends one, so the newest line marks where the agent last opened a page. When the process ends after at least one `open` and the agent has not ended (see "When it ends"), it appends the same address with the label "browser · closed" and `"ended": true`, so the dashboard stops framing it; after the agent ended, it appends nothing, because nothing should follow the agent's end. With no diary, no line is ever written. A failure to append is ignored.

### The person's input

#### Context

See `## Context` of `screen.ts`.

#### Business logic

`back` and `forward` step the page's history and answer 204. Every other input is mapped to DevTools requests by the rules of `screen.ts`; each request is sent to the page the agent is on, a failing one ignored, and the answer is 204, or 400 when the input maps to no request. Every `POST` carrying the token, an input or a command, counts as the browser being used.

### When it ends

#### Context

**Problem**: see `## Context`.

#### Business logic

Every two seconds the process checks, in order:

- When no command and no input has arrived for the idle time it was started with (30 minutes, from `cli.ts`), it ends. Watching the screen page, and the screen page asking for the address every second, do not count.
- When it was given a diary: the diary's file gone (the agent's checkout reclaimed) counts as the agent having ended, and it ends. Otherwise the whole lines written since the last check (since the process started, for the first), up to the last line break, are read, counted in bytes; a line still being written is left for the next check, when it is read complete. Each line is read as JSON, a line that is not JSON skipped; a line whose `kind` is `ended`, the line the tool running the agent appends when the agent ends, counts as the agent having ended, and it ends. An `ended` line written before the process started, such as an earlier session's, does not count.

It also ends when `close` is run, when Chrome exits, and when the process is told to terminate or interrupted.

### Ending

#### Context

See `## Context`.

#### Business logic

Ending happens once, whatever asked for it first: the checks stop, every open picture stream is ended, the connection to the page is closed, the server stops and drops every connection, the `ended` screen line is appended when due (see "The screen lines in the diary"), Chrome is closed and its profile removed, and the state file [7] is removed when it still holds this process's token, so the next `browser` call finds no browser open; when it holds another token, it belongs to a browser started after this one closed, and it stays.
