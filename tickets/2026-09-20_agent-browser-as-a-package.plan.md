Effort: 6
Uncertainty: 6
Outdated: yes

# [Plan] The agent's browser as a package: the first package that extends a run

What "a package adds something to a run" means, worked out on the browser: the plug the run tool
offers, the address the run's card carries, and the tab the run page shows.

## TLDR

The browser itself is a move from history. The new thing is a plug, and it is three small contracts:

1. **The plug.** `agent-scheduler run` reads the project's packages and, for each one declaring
   `"framework": { "run": "<command>" }`, runs `<command> attach --run <id> --checkout <path>`
   beside the agent, for the run's life. The command prints one JSON document when it is up — the
   MCP server the agent should get, and the loopback address a person can watch — and stays up
   until the run ends.
2. **The address.** What the plugs answered goes on the run's card under `caller.run.<package>`,
   written into the card's starting fields before the session opens. Every reader of a run already
   reads the card.
3. **The tab.** A widget gains `runPanels`: a component the dashboard mounts as a tab on the run
   page, for a run whose card names that package. The daemon proxies same-origin from
   `/_run/<project>/<run>/<package>/…` to the address the card names, and to nothing else.

Then the package: `@gemstack/skill-browser`, with the Chrome launcher, the stream server and the
panel brought back from `43c4de5b^`, a SKILL.md for the agent, and a package.json declaring both
`framework.run` and `exports["./dashboard"]`.

## What is already there

Read before designing anything: what the ticket calls "deleted, not kept dark" is exact — the two
framework files that still carry browser names hold something else.

- The feature itself is only in history, at `43c4de5b^`: `packages/framework/src/browser.ts` (317
  lines then) launching Chrome on a throwaway profile with `--remote-debugging-port` and making the
  MCP spec pointing at it; `src/browser-stream.ts` (344 lines then) serving that Chrome as MJPEG on
  a port the OS picks and taking clicks, keys, scrolls and navigations back over POST;
  `dashboard/components/BrowserPanel.tsx` and `InlineBrowser.tsx` (the viewer);
  `src/dashboard/browser-proxy.ts` (125 lines: `/browser/<project>/<agent>/stream|input`, the port
  read off the agent's own meta); `prompts/protocols/browser.md` (the words the agent read).
- What kept those two file names on main is not the feature: `browser.ts` is down to 41 lines and
  `browser-stream.ts` to 60, holding `freePort`, `waitForDebugEndpoint` and `connectCdp` — the CDP
  plumbing `src/bridge-browser.ts` uses for the daemon's sign-in Chrome, and nothing else.
- Dead marks of the feature still on main: the `browser-stream` and `browser` event kinds
  (`packages/framework/src/events.ts:180`), their terminal line (`src/terminal.ts:20`) and their
  colour rule (`dashboard/components/EventList.tsx:110,117`).
- `packages/framework/src/bridge-browser.ts` is the daemon's own Chrome for the web sign-in. It is
  not this, it moves nowhere, and nothing here touches it — but it owns those three helpers, which
  is why the package will carry its own copy of them (below).

What the modules work already gives us, and what it does not:

- `readProvidedCommand(root, kind)` (`packages/framework/src/project-widgets.ts:145`) is how a
  project's package declares it provides something; `runPackageCommand` (:215) runs it. Both live
  in the framework package.
- `agent-scheduler` does not depend on the framework, and the framework does not depend on
  `agent-scheduler`. Both depend on `@gemstack/agent-data`.
- A run's card carries `caller`, a free record the logs package stores and never reads
  (`packages/skill-logs/src/run.ts:36`), and the framework unfolds it into the meta the dashboard
  shows (`packages/framework/src/store/run-record.ts:15`).
- A widget is `pages` and `linkActions` and nothing else
  (`packages/framework/dashboard/widget/index.ts:94`). There is no run-page slot; #1817 left it for
  the first package that needs one.
- The run starts at `packages/agent-scheduler/src/run.ts:103`: the checkout is made, the starting
  card is built (:147) and the session opens with `driver.start` (:354). The driver itself was
  built earlier, by `driverFor` (`src/scheduler.ts:260`), before any checkout exists.
- Claude Code takes MCP servers at driver construction (`packages/agent-driver/src/claude-code.ts:41`),
  written to a `--mcp-config` file lazily per session (:202). `DriverStartOptions`
  (`packages/agent-driver/src/types.ts:52`) has no MCP field. The Codex driver has no MCP at all.

## Problems

Rated for how much a better way might exist:

- **P1 — the plug's shape and lifetime (8).** Nothing in the tool starts something that must live
  as long as the agent and die with it.
- **P2 — who may read a package's declaration (5).** The reader is in the framework; the run tool
  cannot import it.
- **P3 — handing the agent the tool (6).** The MCP spec is known only after the checkout exists,
  and the driver was built before that.
- **P4 — where the address lives (4).** The dashboard must find a run's browser without the
  framework knowing what a browser is.
- **P5 — the run-page slot (7).** What a package puts on a run page, and when the tab is there.
- **P6 — the proxy (5).** Same-origin for the pane, without becoming a relay into anything on
  loopback.
- **P7 — the words the agent reads (2).**
- **P8 — whether every run gets a browser (6).**
- **P9 — Chrome that outlives its run (5).**

## Solutions

### P1 — the plug

- **A. A long-lived child of the run's process (recommended).** `<command> attach --run <id>
  --checkout <path>`: prints one JSON document on stdout when it is up, then stays. The run tool
  reads that line, keeps the child, and SIGTERMs it when the session ends — in the same `finally`
  that disposes the driver session, so a stop, a failure and a normal end all close it. One
  lifetime, no second command, nothing to reconcile.
- B. A `start` command that detaches its own daemon and a `stop` command that kills it. Two
  commands, two failure modes, and a stop that never runs leaves a Chrome behind with nobody
  responsible for it.
- C. A module the run tool imports. Rejected: every other package talks through a command, and a
  module would make the run tool resolve and load package code.

Several packages may declare `run`, and **all** of them attach — unlike a provider (`tickets`,
`queue`, `runs`, `branches`), where the first declaring package wins because a project has one
queue. An extension is plural by nature; the reader needs a "every package that declares it"
variant beside today's "the first one".

Bounded like every other package command: a handshake that does not arrive within a timeout
(say 30s) means no extension — the run goes on without it, and the diary says so. A plug that
fails never fails the run.

### P2 — the reader

- **Move `projectPackages` / `readProvidedCommand` into `@gemstack/agent-data` (recommended)**, and
  have the framework re-export what it uses. Both sides then read one answer to "which package
  provides what", and `agent-data` is already the shared floor.
- B. A second small reader inside `agent-scheduler`. Rejected: two readers of one convention drift.
- C. The framework reads the packages and passes them to the run tool. Rejected: a run also starts
  from a shell, with no framework in sight.

### P3 — the tool for the agent

- **`DriverStartOptions.mcpServers` (recommended)**: a per-session map, merged over the driver's
  own in `ClaudeCodeSession.mcpConfigFile()`. `run.ts` passes what the plugs answered at
  `driver.start`. The driver stays built where it is built.
- B. Build the driver after the plugs answer (`driverFor` takes the specs). Rejected: the run tool
  would have to know each driver's construction options, and a resume builds its driver elsewhere
  again.

A driver with no MCP (Codex today) gets no tool: the plug still runs, the person can still watch
the page, and the agent simply has no browser. Say it plainly in the package's SKILL.md rather than
refusing the run.

### P4 — the address

- **`caller.run.<package>` on the run's card (recommended)**, exactly what the plug printed, put
  into the card's starting fields at `run.ts:147` before the session opens — so it is on the live
  card from the first write, and on the record afterwards, with no patch. `caller` is already "the
  writer's own record, stored as given"; the framework unfolds it and the dashboard has it.
- B. A diary line announcing the port, as the old runner did (`announceBrowserPort`). Rejected: a
  reader would have to replay the diary to learn a fact that is true for the whole run.

### P5 — the run-page slot

- **`WidgetDefinition.runPanels?: RunPanel[]` (recommended)**: `{ label, icon?, Panel }`, and the
  panel is given `{ projectId, run, extension, url(path) }` — the run as `WidgetAgent`, the card's
  own `caller.run[<this package>]` entry, and a function building the proxied same-origin path for
  this run and this package. The dashboard mounts it as a tab on the run page (`AgentView.tsx`)
  **only** when the run's card names that package: no package, no tab; a run started before the
  package was installed, no tab. The framework never learns what a browser is — only that a
  package attached to a run.
- B. A panel always shown, deciding for itself whether it has anything. Rejected: an empty
  "Browser" tab on every run of a project.
- C. Reuse `pages` with a run-scoped sub-path. Rejected: the run page is where a person watches the
  run; a second page is a second place.

### P6 — the proxy

`/_run/<projectId>/<runId>/<package>/<rest…>`, beside `WIDGETS_PREFIX`
(`packages/framework/src/dashboard/widget-serve.ts`): the daemon resolves the run's card, reads
`caller.run[package]`, and proxies to that address only — loopback only, port never named by the
client, methods and bodies passed through, the MJPEG response streamed. Anything else 404s.
`43c4de5b^:packages/framework/src/dashboard/browser-proxy.ts` is the skeleton; what changes is that
the two legs (`stream`, `input`) become whatever path the package's own server serves, and the port
comes from the card rather than from a meta field named `browserPort`.

### P7 — the words

The package ships `SKILL.md`, like every other skill package; `43c4de5b^:packages/framework/prompts/protocols/browser.md`
is its source text. Nothing in the framework ships prompt text any more, and this keeps it that way.

### P8 — whether every run gets a browser

- **Every run of a project that installs the package (recommended).** The start hook carries
  `PROMPT`, `DRIVER`, `MODEL`, `THEN` and nothing else (`project-hooks.ts:156`); a per-package
  launcher row would be the option-per-feature the modules work just removed. A project that does
  not want a Chrome per run does not install the package.
- B. A launcher box, as `--browser` used to be. Rejected for the above; if a per-run choice is ever
  wanted, it belongs to the package (a line in the prompt, its own config), not to the framework's
  hook contract.
- Cost to accept and to state: a Chrome per run in a project that installed it, whether the agent
  browses or not. The package may read its own project config to stay out of runs it should not be
  in; that is the package's business, not the plug's.

### P9 — Chrome that outlives its run

The attach child dies with the run in every ordinary end, including a stop (SIGTERM reaches it from
the same handler that aborts the session). A run whose process is killed outright leaves a Chrome:
the throwaway-profile prefix the old `browser.ts` used (`framework-chrome-`) already marks an
agent's Chrome, so the package's own command can sweep profiles whose run is no longer recorded
running — and the scheduler's existing sweep is where that is triggered from, if anywhere.

## Considerations

- A resume (`resumeRun`) must attach again: the run gets a new address, and the card written at the
  resume carries the new one. The panel keys on the card, so it follows.
- A follow-up run (`run --then`) is a run of its own and attaches on its own.
- A run that ends keeps its card, so the tab remains, pointing at an address nothing answers. The
  old panel already handled a dead stream (`InlineBrowser` kept a last still); simplest correct
  behaviour is the panel saying the run has ended.
- The proxy must be reachable for a run whose checkout is gone (the card lives on the data branch
  by then) — it resolves through the same run lookup the rest of the dashboard uses, not through
  the checkout.
- Headless is not on the table: Cloudflare blocks it. The old code launches a real, off-screen
  Chrome; keep that as it is and do not revisit it here.
- Nothing in this gives the dashboard's page origin access to Chrome's debug port: the package's
  own server is still the only way in, and the daemon is still the only client of it.
- The CDP helpers (`freePort`, `waitForDebugEndpoint`, `connectCdp`, ~100 lines) are used by the
  daemon's bridge browser as well as by the agent's. A package cannot depend on the framework, so
  it carries its own copy and the framework keeps its own for the bridge browser. Two copies of a
  hundred lines of Chrome plumbing is the cheaper of the two prices; the alternative is a third
  package for them, which is a package nobody asked for.
- The e2e story harness already links a package into a product project and waits on it (the
  branches PR did this); the story here is: a run starts, a tab appears on its page, the stream
  answers, the run ends, the Chrome is gone.
- LOGIC.md beside every file touched, and DECISIONS entries in `packages/framework/DECISIONS.md`
  and `packages/agent-scheduler/DECISIONS.md` for the plug, the address and the slot.

## Implementation

Six commits, each buildable and tested on its own; the first four are the plug and can land before
the package exists.

1. **The reader moves.** `projectPackages`, `readProvidedCommand` and a new `readProvidedCommands`
   (plural, for kinds several packages may declare) into `@gemstack/agent-data`; the framework
   re-exports and keeps `project-widgets.ts` for the widget half. No behaviour change; existing
   tests cover it.
2. **agent-driver: MCP per session.** `DriverStartOptions.mcpServers`, merged over the driver's own
   in `ClaudeCodeSession`; Codex ignores it. One test proving the written `--mcp-config` holds both.
3. **agent-scheduler: the plug.** Read the project's `framework.run` declarations; after the
   checkout and before the card, spawn each `<command> attach --run <id> --checkout <path>`, read
   one JSON document with a timeout, put the answers on the card under `caller.run`, pass the MCP
   specs to `driver.start`, and SIGTERM every child in the session's `finally`. Tests over a fake
   attach script in `test-repo.ts`: it answers, it is on the card, it is killed on a normal end, on
   a stop and on a failure; one that never answers is skipped and the run still runs.
4. **framework: the proxy and the slot.** `/_run/<project>/<run>/<package>/…` beside the widget
   files route, refusing any address the card does not name; `runPanels` in `widget/index.ts`,
   mounted as tabs in `AgentView`, with the host giving the panel its `url(path)`; tests for the
   route's refusals and for a panel mounted only where the card names its package.
5. **The package.** `packages/skill-browser`, built from `43c4de5b^`: the Chrome launcher and the
   stream server as its own modules (with their own copy of the CDP helpers), a `browser` command
   whose `attach` launches both and prints the handshake, `SKILL.md` from the old protocol text,
   `DECISIONS.md`, and a `./dashboard` widget whose one run panel is `BrowserPanel` +
   `InlineBrowser`, talking to `url('/stream')` and `url('/input')`. package.json declares
   `"framework": { "run": "browser" }` and `exports["./dashboard"]`.
6. **The leftovers and the proof.** Drop the `browser` / `browser-stream` event kinds and their
   terminal and colour branches; the e2e story above; DECISIONS in both packages; this repository
   installs the package and runs a dogfood run with it.
