Effort: 6
Uncertainty: 5

# [Plan] The agent's browser as a package: the first package that extends a run

What "a package adds something to a run" means, worked out on the browser: the plug the run tool
offers, the address the run's card carries, and the message the run's chat shows.

## TLDR

The browser itself is a move from history. The new thing is a plug, and it is three small contracts:

1. **The plug.** `agent-scheduler run` reads the project's packages and, for each one declaring
   `"framework": { "run": "<command>" }`, runs `<command> attach --run <id> --checkout <path>
   --diary <path>` beside the agent, for the run's life. The command prints one JSON document when
   it is up — the MCP server the agent should get, and the loopback address the dashboard may
   reach — and stays up until the run ends.
2. **The address.** What the plugs answered goes on the run's card under `caller.run.<package>`,
   written into the card's starting fields before the session opens. The daemon proxies
   same-origin from `/_run/<project>/<run>/<package>/…` to the address the card names, and to
   nothing else.
3. **The message.** The package appends its own lines to the run's diary —
   `{"kind":"browser","from":"<package>","url":…}` each time the agent's browser lands on a new
   page — and its widget gains `messages`: a component per line kind. The dashboard renders such a
   line in the chat, where a text message would be, through the widget of the package the line is
   `from`. For the browser that component is the live, interactive browser with its own address
   bar. No tab, no run-page slot.

Then the package: `@gemstack/skill-browser`, with the Chrome launcher, the stream server and the
viewer brought back from `43c4de5b^`, a SKILL.md for the agent, and a package.json declaring both
`framework.run` and `exports["./dashboard"]`.

## What changed since the first plan

- The ticket's screen is now a chat message, not a tab: the first plan's `runPanels` slot (its
  P5) is gone, replaced by diary lines a package writes and its widget renders (P5 below).
- The package reader already lives in `@gemstack/agent-data`
  (`packages/agent-data/src/provided-command.ts`: `projectPackages` :50,
  `lookupProvidedCommand` :108, `readProvidedCommand` :130, `runPackageCommand` :147), and the
  scheduler already uses it (`packages/agent-scheduler/src/git-host.ts:35`). The first plan's
  step "the reader moves" is done; only a plural variant is missing.

## What is already there

- The feature itself is only in history, at `43c4de5b^`: `packages/framework/src/browser.ts`
  (Chrome on a throwaway profile with `--remote-debugging-port`, and the MCP spec pointing at it);
  `src/browser-stream.ts` (that Chrome as MJPEG on an OS-picked port, clicks, keys, scrolls and
  navigations back over POST); `dashboard/components/BrowserPanel.tsx` and `InlineBrowser.tsx`
  (the viewer); `src/dashboard/browser-proxy.ts` (the proxy, port read off the agent's meta);
  `prompts/protocols/browser.md` (the words the agent read).
- On main, `packages/framework/src/browser.ts` (41 lines) and `browser-stream.ts` (60 lines) hold
  only `freePort`, `waitForDebugEndpoint` and `connectCdp`, the CDP plumbing of
  `src/bridge-browser.ts` — the daemon's own sign-in Chrome, which this does not touch.
- Marks of the old feature still on main: the `browser-stream` and `browser` event kinds
  (`packages/framework/src/events.ts:171,180`), their terminal line (`src/terminal.ts:18`) and
  their colour rule (`dashboard/components/EventList.tsx:110`). The framework must not know what a
  browser is once this lands, so they go.
- A diary is JSONL, and any writer may add its own kinds: `AnyDiaryLine`
  (`packages/skill-logs/src/run.ts:57`); `fromDiaryLine` passes an unknown kind through as a
  framework event as written (`packages/framework/src/store/run-record.ts:75`).
- The live diary is written by agent-driver's `SessionLog`
  (`packages/agent-driver/src/session-log.ts`): truncated when a fresh session opens (:96), then
  only appended to (:109, :128). A second writer that only appends whole lines after the session
  is open is safe beside it.
- A run's card carries `caller`, stored and never read by the logs package
  (`packages/skill-logs/src/run.ts:36`), unfolded into the meta by the framework
  (`packages/framework/src/store/run-record.ts:15`).
- A widget is `pages` and `linkActions` (`packages/framework/dashboard/widget/index.ts:114`).
- The chat is `EventList` (via `AgentFeed`, mounted in `AgentView.tsx:215`); a `choice` line is
  already rendered as an interactive inline panel there — the precedent for a message that is not
  text.
- The run starts in `runCommand` (`packages/agent-scheduler/src/run.ts:111`): the checkout, the
  starting card (:152), then `session`, which opens the driver with `driver.start` (:356). The
  driver itself was built earlier by `driverFor` (`src/scheduler.ts:251`).
- Claude Code takes MCP servers at driver construction
  (`packages/agent-driver/src/claude-code.ts:41`), written to a `--mcp-config` file per session
  (:190). `DriverStartOptions` (`packages/agent-driver/src/types.ts:52`) has no MCP field. The
  Codex driver has no MCP at all.

## Problems

Rated for how much a better way might exist:

- **P1 — the plug's shape and lifetime (7).** Nothing in the run tool starts something that must
  live as long as the agent and die with it.
- **P2 — reading every package that declares `run` (1).** The reader returns one provider.
- **P3 — handing the agent the tool (5).** The MCP spec is known only after the checkout exists,
  and the driver was built before that.
- **P4 — where the stream address lives (3).**
- **P5 — the message in the chat (6).** A package's line rendered by that package, without the
  framework knowing what a browser is.
- **P6 — the proxy (4).** Same-origin for the viewer, without becoming a relay into anything on
  loopback.
- **P7 — the words the agent reads (1).**
- **P8 — whether every run gets a browser (5).**
- **P9 — Chrome that outlives its run (4).**

## Solutions

### P1 — the plug

- **A. A long-lived child of the run's process (recommended).** `<command> attach --run <id>
  --checkout <path> --diary <path>` prints one JSON document on stdout when it is up, then stays.
  The run tool reads it, keeps the child, and SIGTERMs it in the same `finally` that disposes the
  driver session, so a stop, a failure and a normal end all close it.
- B. `start` detaching its own daemon, `stop` killing it. Rejected: a stop that never runs leaves a
  Chrome with nobody responsible for it.
- C. A module the run tool imports. Rejected: every other package talks through a command.

Several packages may declare `run`, and all of them attach — unlike a provider, where a project has
one. A handshake that does not arrive within 30s (`COMMAND_TIMEOUT_MS`) means no extension: the run
goes on, and the diary says so. A plug that fails never fails the run.

### P2 — the reader

`readProvidedCommands(root, kind)` beside `lookupProvidedCommand` in
`packages/agent-data/src/provided-command.ts`: every installed package declaring the kind, in the
project's dependency order, no "name one" rule.

### P3 — the tool for the agent

- **`DriverStartOptions.mcpServers` (recommended)**: a per-session map merged over the driver's own
  when `ClaudeCodeSession` writes its `--mcp-config`. `session` passes what the plugs answered at
  `driver.start`.
- B. Build the driver after the plugs answer. Rejected: the run tool would learn every driver's
  construction options, and a resume builds its driver elsewhere.

Codex gets no tool: the plug still runs, the pane still shows, the agent has no browser. The
package's SKILL.md says so.

### P4 — the stream address

`caller.run.<package>` on the run's card, exactly what the plug printed, put into the starting
card at `run.ts:152` before the session opens: on the live card from the first write, on the
record afterwards. It is true for the whole run, so it belongs on the card, not repeated on every
diary line.

### P5 — the message

- **A package's diary lines, rendered by its widget (recommended).** The attach child appends
  `{"kind":"browser","from":"@gemstack/skill-browser","url":"https://…"}` to the `--diary` path
  when the agent's browser reaches its first real (http/https) page and again on each change of
  page — the URL only, never a frame: someone will type a password into that pane. `from` is the
  package's name, so two packages may use the same kind without colliding.
  `WidgetDefinition.messages?: Record<string, Message>` names a component per line kind; the
  dashboard renders a line that carries `from` through that package's widget, given `{ line, run,
  live, url(path) }` — `url` builds the proxied path for this run and this package, `live` is
  whether this is the run's last line of that kind from that package while the run is running.
  A line whose package has no widget, or no component for its kind, stays the plain row it is
  today.
- B. Keep the `browser` event kind in the framework and render the viewer there. Rejected: the
  framework would know what a browser is, and the next package extending a run would need the
  framework changed again.
- C. The first plan's run-page tab. Rejected by the ticket: the browser is a chat message, where
  the agent used it.

For the browser: the run has one Chrome, so only the last `browser` line is the live, interactive
pane (address bar with back, forward, reload and the URL, stream, input); an earlier one folds to
its address, a link down to the live one. A run that has ended shows the last line's address and
says the run has ended.

The `--diary` path is given, not built by the package: the package does not learn the live
directory's layout. The child writes only once the agent browses, which is after the session has
opened, so `SessionLog`'s truncation on open (`session-log.ts:96`) cannot remove its lines; the
package still writes nothing before its first navigation, and says why in a comment.

### P6 — the proxy

`/_run/<projectId>/<runId>/<package>/<rest…>`, beside `WIDGETS_PREFIX`
(`packages/framework/src/dashboard/widget-serve.ts:8`): the daemon resolves the run's card, reads
`caller.run[package]`, and proxies to that loopback address only — the client never names a port;
methods and bodies passed through, the MJPEG response streamed; anything else 404s.
`43c4de5b^:packages/framework/src/dashboard/browser-proxy.ts` is the skeleton. It resolves through
the dashboard's run lookup, not the checkout, so it answers (a 404 from a dead address) after the
checkout is gone.

### P7 — the words

The package's `SKILL.md`, from `43c4de5b^:packages/framework/prompts/protocols/browser.md`.

### P8 — whether every run gets a browser

- **Every run of a project that installs the package (recommended).** The start hook carries
  `PROMPT`, `DRIVER`, `MODEL`, `THEN` and nothing else; a per-package launcher row would be the
  option-per-feature the modules work removed. A project that does not want a Chrome per run does
  not install it.
- B. A launcher box, as `--browser` used to be. Rejected for the above.

Cost to state: a Chrome per run in such a project, whether the agent browses or not.

### P9 — Chrome that outlives its run

The attach child dies with the run in every ordinary end, a stop included. A run killed outright
leaves a Chrome; the throwaway-profile prefix (`framework-chrome-`) marks it, so the package's own
command can sweep profiles whose run is not recorded running, triggered from the scheduler's
existing sweep if anywhere. Not in the first cut.

## Considerations

- A resume (`resumeRun`, `run.ts:199`) attaches again: a new address on the card written at the
  resume (:247), and the live pane follows the card.
- A follow-up run (`run --then`) is a run of its own and attaches on its own.
- Headless is not on the table (Cloudflare); keep the old off-screen real Chrome.
- The dashboard's origin never reaches Chrome's debug port: the package's own server is the only
  way in, and the daemon its only client.
- The CDP helpers (~100 lines) are the bridge browser's too; a package cannot depend on the
  framework, so it carries its own copy.
- LOGIC.md beside every file touched; DECISIONS entries in `packages/framework/DECISIONS.md` and
  `packages/agent-scheduler/DECISIONS.md` for the plug, the address and the message;
  FEATURES-SPEC.md gains the browser.

## Implementation

Five commits, each buildable and tested; the first three can land before the package exists.

1. **agent-data + agent-driver.** `readProvidedCommands`; `DriverStartOptions.mcpServers` merged
   in `ClaudeCodeSession` (Codex ignores it). Tests: the plural reader; the written
   `--mcp-config` holds both maps.
2. **agent-scheduler: the plug.** Read every `framework.run`; after the checkout and before the
   card, spawn each attach with `--run`, `--checkout`, `--diary`; read one JSON document with a
   timeout; answers on the card under `caller.run`; MCP specs to `driver.start`; SIGTERM every
   child in the session's `finally`; the same at a resume. Tests over a fake attach script: it
   answers, it is on the card, it is killed on a normal end, a stop and a failure; one that never
   answers is skipped and the run still runs.
3. **framework: the proxy and the message.** The `/_run/…` route refusing any address the card
   does not name; `messages` in `widget/index.ts`; `EventList` rendering a `from` line through its
   package's widget, with `live` and `url(path)`; the `browser` / `browser-stream` event kinds,
   terminal line and colour rule dropped. Tests: the route's refusals; a line rendered by its
   widget, a line with no widget kept as a row, only the last line live.
4. **The package.** `packages/skill-browser` from `43c4de5b^`: launcher and stream server with
   their own CDP helpers, a `browser` command whose `attach` starts both, prints the handshake and
   appends the `browser` lines; `SKILL.md`, `DECISIONS.md`; a `./dashboard` widget whose
   `messages.browser` is the viewer (`InlineBrowser` with an address bar), talking to
   `url('/stream')` and `url('/input')`.
5. **The proof.** An e2e story: a run starts, the agent browses, a browser message appears in the
   chat and streams, the run ends, the Chrome is gone; this repository installs the package and a
   dogfood run uses it.
