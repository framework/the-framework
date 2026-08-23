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

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
