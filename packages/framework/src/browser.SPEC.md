The agent's browser: gives an agent real browser tools (navigate, console, network, DOM, screenshot) and launches the Chrome behind them, so that a human can watch the very page the agent is on.

## User story

- The user turns on browser tools for an agent, and the agent can drive a real browser without anything being installed first.
- The user watches the agent's browsing in the dashboard's browser preview, and takes over when the agent hits a login wall.

## Business logic — TL;DR

- **The Framework launches the browser, not the tool server** - Chrome is started with its debug port open and the tool server is pointed at it, which is what lets a second watcher attach to the same page. Without that, the tool server launches its own browser and nobody else can see it.
- **A throwaway profile** - each agent gets a fresh temporary Chrome profile, so it never inherits or dirties the user's own browsing session, and the profile is deleted when the agent's browser closes.
- **Headless by default** - the agent has no screen, and the preview reads a headless page perfectly well.
- **Found wherever Chrome lives** - an explicitly configured Chrome path wins, then the platform's usual install locations, then the browser names on the system's executable search path.
- **A missing browser costs the preview, never the tools** - if the machine has no Chrome, or the launch fails, or Chrome dies on its own, the agent keeps its browser tools (the tool server launches a browser of its own) and simply gets no preview. The agent is never failed over it.
- **Never handed a port that is not listening yet** - Chrome opens its debug port a beat after starting, so the endpoint is polled until it answers, and a browser that never answers within the timeout is torn down and treated as absent.
- **The browser dies with its agent** - an agent that exits without closing its browser, through an uncaught error or a forced exit, kills the browser on the way out; and an agent the daemon has to kill outright is killed together with its whole process group, browser included. No agent's browser outlives its agent.
- **A leftover browser is known by its profile** - every agent browser runs on a throwaway profile whose name carries a fixed prefix, which marks the browser as launched by an agent. A marked browser whose parent process is gone — inherited by the system's init process, or by any process that is not a Node agent — belongs to no agent any more: the daemon kills it and removes its profile at boot. The browser's helper processes are left to die with it, the daemon's own bridge browser runs on a different profile and is never touched, and on Windows, which has no process listing to read, nothing is swept.

## Rationales

- **Why a sweep as well as the two guards** - the guards cover an agent that exits and an agent the daemon kills; a sweep is still needed for a browser left by an agent that was killed with no daemon behind it, or by a build from before the guards existed. The daemon found one such headless Chrome that had run for almost four days and kept the user's own Chrome from opening, because the system saw a "Google Chrome" already running.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
