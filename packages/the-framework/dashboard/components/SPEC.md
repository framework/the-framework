The dashboard's React component catalog: every page, panel and control the browser app is assembled from.

## User Stories

- The user starts an agent from the launcher — a typed prompt for an attended run, a preset for unattended routine work.
- The user watches a live agent's transcript, answers its questions inline, steers it, stops it, and resumes it.
- The user scans the Overview board for quota pace, running agents, queued work, routine jobs and hot tickets, and answers any agent's open question from there.
- The user filters, sorts and groups every project's tickets on one page, opens a ticket's detail and plan, and queues or starts work from a row.
- The user changes every preference — appearance, driver and model, where agents execute, agent options, notifications, automation — on one settings page.

## Flows

- One shared shell frames every route: the left sidebar (brand, New launcher, Overview / Tickets / Projects navigation, recent agents, utility footer) and a right rail of the agent's files, agent-pushed views, its browser, and surfaced docs. Its pages are the Overview board, the project home/launcher, one agent's view, the cross-project tickets pages (list, per-ticket detail, per-ticket plan), Settings, and not-found.
- The agent surface is a transcript with its controls inline: an action bar carrying the branch / PR / handoff and the one menu of agent actions, the event feed rendering its questions as answerable cards and its browser screencast in place, the changes and handoff panels, and one composer that starts, steers, stops and resumes — in a stable frame, so an ending never blanks what you are reading.
- The Overview's widgets each show one slice of what the daemon knows: quota pace, agents working now, the Human Queue (what currently waits on a person — an agent's question, a PR to review), the AI queue (every project's open `TODO_AGENTS.md` items), routine work, hot tickets, activity and outcomes, and an onboarding checklist whose steps tick off real facts rather than clicks.
- The launcher's controls — presets, driver/model and option menus, the Context selector, the system-prompt preview — read and write the same preferences and mappings the agent itself uses, so no surface can disagree with the agent it configures.
- Everything renders state the daemon owns (reads poll or stream, writes are daemon calls; components keep only view state), and the house rule is honesty: controls name what will actually happen, no state rides on colour alone, warnings teach before an agent is spent but never block, and empty states name their reason instead of dead-ending.
- Two sub-kits supply the raw material: the hand-ported UI primitives and the composer's mention-aware prompt-editor engine.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
