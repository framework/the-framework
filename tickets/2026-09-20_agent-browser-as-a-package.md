Topics: [the-framework, modularity]
Issue: [#1819](https://github.com/framework/the-framework/issues/1819)

# The agent's browser as a package: the first package that extends a run

## TLDR

The browser an agent drives during a run — a Chrome the run launches, wired to the agent as a tool, and a panel on the run page that streams it so a person can watch and take over — should be a package. It is the first package that extends a run rather than the dashboard. Not the bridge browser the daemon keeps for the web sign-in; that one stays where it is.

## Why it matters

The four modules so far only provide data to the dashboard. The browser needs something new: a plug for "a package adds something to a run". That plug is what Discord as a module needs mirrored on the framework side, and what any later "give the agent a tool" package reuses.

## What it was

Before #1798 the daemon's own runner launched the browser, gave the agent its MCP tool, wrote the stream port on the run, and the dashboard showed a Browser tab on the run (`BrowserPanel.tsx`, `InlineBrowser.tsx`, `src/dashboard/browser-proxy.ts`), with the launcher's Browser option row and `prompts/protocols/browser.md` teaching the agent to use it. #1798 deleted all of it with the runner (deleted, not kept dark). The last commit with every file is 43c4de5b^.

## Why a package

- Optional: most projects never need it; one that does installs it.
- Its three parts map onto what a package is: SKILL.md for the words the agent reads, a command for the run-time part, a widget for the screen.
- Self-contained: needs nothing from tickets, queue, logs or branches, and they need nothing from it.

## What is new

Something must launch the browser when a run starts, hand the agent the tool (the MCP config for Claude Code), and write the stream port on the run's card so the dashboard finds it. No plug exists yet for that. The run tool (`agent-scheduler run`) would read the project's packages, the way the framework reads providers, and let a package hook into a run's start. That plug is the design decision.

## The screen

The run-page slot deferred at #1817, finally with a package that needs it: the Browser tab on a run comes from the package's widget, streaming from the address the run's card names; the daemon's proxy reads that address from the card.

## Order

After the Overview cards move to their packages (#1818): those are two moves with a slot already known. The browser then defines the run plug. The panel and the proxy are a move from history; the run half is the new work.

## See also

#1818 (what the module PRs left behind), #1820 (no forge, other forges).
