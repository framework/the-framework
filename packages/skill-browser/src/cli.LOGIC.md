The `browser` command: the eight commands an agent [1], or a person in a shell, runs to drive the project's browser. Each call is short: it finds the project's browser's process [2] through the state file [3], starting it on `open` when there is none, forwards the command, and prints what comes back, the page as text on stdout, a refusal on stderr, with an exit code that says how it went.

## Context

**User story**: the agent runs `browser open localhost:3000`, reads the page it prints, types and clicks by element number, and closes the browser; every call finds the same browser, on the same page.

**Business logic story**: the browser lives in its own process between calls (`host.ts`); this command only finds it, starts it, and talks to it with its token [4].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the browser's process: the background process that keeps one project's browser: its Chrome, its connection to the page, and the loopback HTTP server that takes the agent's commands and serves the screen page. Started, detached, by the first `browser open`; one per project.
[3] state file: `skill-browser/<hash>.json` under the machine's temporary directory, the hash taken from the project's root: how the `browser` command finds the project's browser's process (its pid, its port and its token), or learns why it could not start.
[4] token: 32 random hexadecimal characters the browser's process draws when it starts; every request to it must carry it, in the address's `t` parameter or the `x-browser-token` header.

## Business logic — TL;DR

- **The command line** - `open <address>`, `read`, `click <n>`, `type <n> <text>`, `press <key>`, `screenshot [file]`, `eval <script>`, `close`, each with exactly its arguments; no command, an unknown command or a wrong number of arguments prints the usage on stderr and exits 2; `--help` or `-h` prints it on stdout and exits 0.
- **One browser per project** - the project is the git root of the current directory, or the directory itself outside a repository; its state file [3] is named by a hash of that root, in a directory that must be this user's own and is kept closed to others.
- **Finding the browser, or starting it** - a state file whose process answers is used; a stale one is removed; with no browser, every command but `open` is refused, and `open` finds a Chrome and starts the browser's process [2] detached, with this command's environment, waiting up to 30 seconds for it; a lock file lets only one `open` start it, and a second `open` meanwhile waits for the first's browser.
- **Forwarding the command** - the command goes to the process with the token [4]; its answer's text is printed on stdout; a refusal is its reason on stderr and exit 1; a process that stops answering, or does not answer within 90 seconds, is a refusal.
- **A screenshot** - saved at the given path, relative to the current directory, or a new temporary file, and its path printed; a file that cannot be written is a refusal.

## Business logic

### The command line

#### Context

**Problem**: a wrong command line must never start a browser or touch one.

#### Business logic

The command is `browser <command>`. `open`, `click`, `press` and `eval` take exactly one argument, `type` exactly two, `screenshot` none or one, `read` and `close` none. No command, an unknown command or a wrong number of arguments prints the usage on stderr and exits 2, before anything else runs; with `--help` or `-h` the usage is printed on stdout and the exit code is 0. The usage lists the eight commands with one line each and says: "Exit code 1 for a refusal (the reason on stderr), 2 for a usage error."

### One browser per project

#### Context

**User story**: two agents in two checkouts each have their own browser; every call from anywhere inside one checkout reaches the same browser.

#### Business logic

The project is the root git names for the current directory; outside a repository it is the current directory itself. The state file [3] is `skill-browser/<the first 16 hexadecimal characters of the SHA-256 of the root>.json` under the machine's temporary directory.

After the command line is read and before the browser is looked for, the `skill-browser` directory is made when missing, open to its owner only. When it belongs to another user, every command is refused: "<directory> is not this user's own directory: remove it, then run the command again.", because a state file there says where commands go. When it is this user's but open to others, it is closed to them.

### Finding the browser, or starting it

#### Context

**Problem**: a browser's process can die without removing its state file, and a state file can hold an error from a failed start; neither may be mistaken for an open browser.

#### Business logic

A state file that holds a pid, port and token is used when the process answers a request for its state at `127.0.0.1` on that port with the token; when it does not answer, the file is removed. A state file holding an error, or one that cannot be read, counts as no browser. With no browser:

- Any command but `open` is refused: "No browser is open. Start one with `browser open <address>`."
- `open` finds a Chrome by the rules of `chrome.ts`; with none, it is refused: "No Chrome on this machine: install Google Chrome, or set CHROME_PATH to a Chrome or Chromium executable." Otherwise it takes the lock file `<state file>.starting`, created only when no such file exists. The `open` that takes it removes any old state file and starts the browser's process [2] (`host-main.ts`) detached, so it outlives this call, with its output discarded, this command's environment (so `AGENT_DIARY` reaches it), and an idle time of 30 minutes, and removes the lock once its wait below is over. An `open` that finds the lock taken starts nothing and waits for the same state file, so two `open`s at once start one browser; a lock more than 35 seconds old, left by a command that died while starting, is removed and the start tried again. Either way the command then reads the state file every 100 ms: the process's pid, port and token are used as soon as they appear; an error there is refused as "The browser could not start: <error>"; no file after 30 seconds is refused as "The browser could not start: it did not answer within 30s".

### Forwarding the command

#### Context

See `## Context`.

#### Business logic

The command and its arguments are posted to the process on `127.0.0.1` at its port, with the token [4] in the `x-browser-token` header. When the answer says no, its reason is printed on stderr and the exit code is 1. When the process cannot be reached, answers with something unreadable, or has not answered after 90 seconds, the refusal is "The browser stopped answering: <the error>". Otherwise the answer's text (the page as read, the script's JSON, "The browser is closed.") is printed on stdout and the exit code is 0.

### A screenshot

#### Context

**User story**: the agent saves what the page looks like, to look at the picture itself.

#### Business logic

The PNG the process answers is written to the path the agent named, resolved against the current directory, or, when none was named, to `browser-<milliseconds since 1970>.png` in the machine's temporary directory; the file's full path is printed on stdout. When the file cannot be written, the refusal is "The screenshot could not be saved to <path>: <the error>".
