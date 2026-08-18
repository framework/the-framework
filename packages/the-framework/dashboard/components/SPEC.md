The dashboard's React component catalog: every page, panel and control the browser app is assembled from.

## TLDR

- One shared shell frames every route: the left sidebar (brand, New launcher, Overview / Tickets / Projects navigation, recent agents, utility footer) and a right rail of agent-pushed views, surfaced docs and project history. Its pages are the Overview board, the project home/launcher, one agent's view, the cross-project tickets pages (list, per-ticket detail, per-ticket plan), Settings, a read-only shared watch view, and not-found.
- The agent surface is a transcript with its controls inline: an action bar carrying the branch / PR / handoff and the one menu of agent actions, the event feed rendering its questions as answerable cards and its browser screencast in place, the changes and handoff panels, and one composer that starts, steers, stops and resumes — in a stable frame, so an ending never blanks what you are reading.
- The Overview's widgets each show one slice of what the daemon knows: quota pace, agents working now, the Human Queue, the AI queue, routine work, hot tickets, activity and outcomes, and an onboarding checklist whose steps tick off real facts rather than clicks.
- The launcher's controls — presets, driver/model and option menus, the Context selector, the system-prompt preview — read and write the same preferences and mappings the agent itself uses, so no surface can disagree with the agent it configures.
- Everything renders state the daemon owns (reads poll or stream, writes are daemon calls; components keep only view state), and the house rule is honesty: controls name what will actually happen, no state rides on colour alone, warnings teach before an agent is spent but never block, and empty states name their reason instead of dead-ending.
- Two sub-kits supply the raw material: the hand-ported UI primitives and the composer's mention-aware prompt-editor engine.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
