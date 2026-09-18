Implements the `the-framework` command: four options and no verbs. The bare command serves the dashboard in the foreground; the command runs no agent. An agent [1] is started from the dashboard, by the project's own start hook [2], and belongs to whatever tool that hook names.

## Context

**User story**: the user runs `the-framework` inside a project's checkout and gets the dashboard at `http://127.0.0.1:4200`; Ctrl+C closes it. Everything else the user does (start an agent [1], watch it, answer its question, stop it) happens in the dashboard.

**Problem**: a command with a second, private mode for starting agents would make the daemon the owner of a runner. The daemon names no tool, so the command has nothing to run but the dashboard.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] start hook: the one shell line under `start` in a project's `.the-framework/hooks.yml`, which the daemon runs when the user presses Start; it answers the id of the agent it began.
[3] daemon token: the shared secret that authenticates a dashboard exposed to the network: generated once for a daemon bound to a non-loopback address, kept in `~/.the-framework.json`, carried by the URL the terminal prints, and required on every request.

## Business logic — TL;DR

- **Four options and no verbs** - `--port`, `--host`, `--help`, `--version`; anything else, the retired `--agent` included, is a usage error that exits with code 2.
- **The version is read from the package** - the installed package's own `package.json` names the version, and an unreadable one reads as `unknown`, never as a number.
- **Serving the dashboard in the foreground** - the bare command runs the daemon in the current directory on port 4200 and `127.0.0.1`, prints where it runs, blocks until signaled, and exits 1 when it cannot start.
- **Exposing the dashboard to the network** - a non-loopback `--host` creates the daemon token before listening, prints a security warning, and prints the URL that carries the token.
- **The startup footer and the update check** - the version and the help pointer are printed at once; whether a newer version is on npm is printed a moment later, or not at all when npm does not answer.

## Business logic

### Four options and no verbs

#### Context

**User story**: `the-framework --help` shows everything the command accepts; the user never starts an agent [1] from this command line: a run is started from the dashboard, by the project's own start hook [2].

#### Business logic

The command accepts `--port <n>`, `--host <addr>`, `-h`/`--help` and `-v`/`--version`, and nothing else: it runs no agent. `--port` must be a non-negative integer (`0` asks for an ephemeral port); anything else is "invalid --port: must be a non-negative integer". `--host` without a value is "invalid --host: missing address". Any other word is "unknown option: <word>" when it starts with a dash and "unknown command: <word>" otherwise, so a verb such as `start` is refused, and so is `--agent`, the option the daemon once started its own agent processes with. A usage error is printed together with "Run `framework --help` for usage." and the exit code is 2, whatever else was on the line. Otherwise, in this order of precedence: `--help` prints the help text (which presents the command as `framework`) and exits 0; `--version` prints the version and exits 0; and the bare command serves the dashboard. The help text says that everything else is the dashboard: it shows a project's agents [1] from their files, and starts one through the project's own start hook [2] in `.the-framework/hooks.yml`, which names the tool that runs it.

### The version is read from the package

#### Context

**Problem**: the packages are legitimately versioned `0.0.0` while unreleased, so a numeric fallback would make a failed read indistinguishable from a correct one.

#### Business logic

The version is read once from the `package.json` of the installed package itself, next to the compiled build. When that file cannot be read or has no version, the version is the word `unknown`.

### Serving the dashboard in the foreground

#### Context

**User story**: the user runs `the-framework` in a project and the dashboard is up; Ctrl+C closes it. An agent [1] in flight is not the dashboard's process and goes on to its end. There is no background mode.

#### Business logic

The daemon runs in the directory the command was run in, on port 4200 unless `--port` says otherwise, on `127.0.0.1` unless `--host` says otherwise; everything the daemon then does is `daemon.ts`'s. Once it is listening the terminal shows "◆ dashboard running: <url>" and "  Ctrl+C to stop the dashboard. Server logs stream below.", then the startup footer described below, and the daemon's own logs stream after it. The process blocks until it is signaled and exits 0 when the daemon stops. If the daemon cannot start, "could not start the dashboard (<reason>)." is printed and the exit code is 1.

### Exposing the dashboard to the network

#### Context

**Problem**: the daemon spawns processes, so anyone who reaches its port can run code on the machine. The daemon token [3] is the only guard, and the user must be told so before the daemon is left running.

#### Business logic

When `--host` is a non-loopback address, the daemon token [3] is created, or the existing one reused, before the daemon listens, so the URL that carries it can be printed the moment the daemon is up. Beside the running line the terminal warns "⚠ SECURITY: bound to <host> (non-loopback). This exposes code execution to your network; the shared token is the only guard", then prints "  Open with the token (swap <host> for this machine's reachable address, e.g. a Tailscale hostname):" followed by the URL with `?token=<token>` appended, because the bound address is typically a bind-all address such as `0.0.0.0` that no browser can open. A loopback bind creates no token and prints no warning. How the token is made and stored is `registry.ts`'s; how requests are checked against it is the daemon's.

### The startup footer and the update check

#### Context

**User story**: the user who just started the dashboard sees which version runs and whether a newer one exists, without the start waiting on the network.

#### Business logic

After the running lines the terminal prints "Type a prompt on the dashboard to start an agent, or use:", "  framework --help              All options" and "The Framework v<version>". Then, without holding anything up, the npm registry is asked whether a newer version of the package is published; the answer line lands a moment later above the daemon's logs, either "✅ Up to date (v<version>)" or an "⬆️  Update available" line naming the newer version and the install command. When the registry does not answer within 2.5 seconds, or the machine is offline, no line is printed at all. The comparison and the wording are `update-check.ts`'s.
