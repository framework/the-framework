The browser app the daemon [1] serves: the product's only user interface, and a pure projection [2] of the same files the daemon and its agents [3] write. It reads by calling the daemon by name, follows the selected agent over one live event stream [4], and steers agents back through the same daemon — so watching an agent work and reading it back months later show the same record, and nothing the user sees is state the browser invented. `index.html` and `tailwind.css` are the page shell and the theme, `vitest.config.ts` and `vitest.setup.ts` configure the test runner, and `public/` holds the logo; none carries business logic.

## Context

**User story**: the user opens one address and finds everything: what every agent [3] on this machine is doing, what needs them across all their projects, their tickets and their agent queue [5], where the account's quota [6] stands, and the settings behind all of it. They start work from the same page, answer an agent's question where it was asked, chat with a running agent, and send its work off as a pull request.

## Glossary

[1] the daemon: the one foreground process per machine: serves the dashboard, starts agents, runs the sweeps.
[2] projection: a view computed from the files the daemon and its agents write, never from state of the browser's own.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout.
[5] the agent queue: the priority-ordered list of what agents will work on next.
[6] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.

## Business logic — TL;DR

- **The URL is the selection** (`App.tsx`, `main.tsx`) - what the address names is what the app shows: the cross-project Overview, a project's own page, one agent [3] live or replayed, the tickets and one ticket's plan, or Settings. Around whichever page that is, the app keeps the rails, runs the polls every page shares, holds the selected agent's live stream [4], and turns two of the polled feeds into browser notifications.
- **The pages and panels** (`components/`) - every page the user sees and every control on it: the Overview, a project's home and launcher, one agent's view with its feed, gates, chat and handoff, the tickets pages, Settings, and the primitives and the rich prompt editor they are assembled from.
- **What the views render and decide** (`lib/`) - the browser-side logic behind those pages: the agent state derived from the event stream so live and replay agree, the URL as the selection, the preferences and saved devices, the notifications, the ticket filtering, and the shared wording of dates, labels and status colors.
- **How the daemon is called** (`rpc/`) - typed stubs for every call the daemon [1] answers, declared against the daemon's own signatures, so a renamed or re-shaped call is a build error here rather than a broken page in the browser.
- **The design gallery** (`design/`) - the dashboard's own components and design foundations rendered to static pages in both themes, from the shipped components and the shipped stylesheet, so a card cannot drift from the app.
- **Running it while developing** (`vite.config.ts`, `test-utils.ts`) - the dev server that can bring a real daemon up inside itself so the app has live data to render, and the world the component tests render into.
