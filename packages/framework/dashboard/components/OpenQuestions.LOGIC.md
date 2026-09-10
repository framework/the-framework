The "Waiting on you" section: every open question [1] across all projects, longest-waiting first, each rendered as the gate [2] card the agent [3] view itself shows and answerable in place — including questions a cloud session [7] is parked on, which are answered through the Claude web bridge [8]. An answered question collapses to one ✓ line and stays until the page is reloaded; nothing auto-accepts here.

## Context

**User story**: several agents in several projects have stopped at a question; instead of visiting each agent, the user answers all of them from one place, jumps into the agent when the question needs more context, and sees what they picked after answering.

**Problem**: a page that renders every parked gate at once must never count down to the recommended option: that would be a mass auto-accept ten seconds after the page opens.

## Glossary

[1] open question: a gate nobody has answered yet, as the dashboard lists them across projects.
[2] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] agent view: one agent's page.
[7] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[8] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.

## Business logic — TL;DR

- **When the section exists** - the daemon's list of open questions [1] is re-read every 5 seconds; with nothing open and nothing just answered, no section at all.
- **One card per question** - each card names the agent [3] and its project, offers "Open session →" into that agent, and shows the gate [2] card with the auto-accept countdown off.
- **Answering** - a pick [4] is posted against the question's own project and agent (through the bridge [8] for a cloud session [7]); a failed post keeps the gate open with the reason shown.
- **An answered question collapses and stays** - it becomes a ✓ line that expands to show the options with the pick marked, keeps "Open session →", and survives the daemon dropping the gate until the page is reloaded.
- **Order, count and the jump list** - open cards first in the daemon's order, then answered leftovers; the heading counts open ones only; with more than one card a jump list on the right scrolls to any of them.

## Business logic

### When the section exists

#### Context

**Problem**: an empty "Waiting on you" on every visit is noise.

#### Business logic

The list of open questions [1] is re-read from the daemon every 5 seconds, ordered by the daemon with the longest-waiting first. Until the first answer arrives, and whenever there is neither an open question nor a question answered since the page loaded, the section is not rendered at all: no heading, no empty state.

### One card per question

#### Context

See `## Context`.

#### Business logic

The section is titled "Waiting on you · <count of open questions>". Cards scroll inside their own area, capped at 70% of the viewport's height. Each open card has:

- A header button (tooltip "Open this session") showing the agent's [3] label — its session name [5], else the first line of its intent cut at 80 characters, else its agent id — and the project's name, with "Open session →" on the right. Clicking it opens that agent's agent view [6], switching project when the agent belongs to another project.
- The gate [2] card itself (`ChoicePanel.tsx`: the question, its options, the recommended one), rendered with its countdown off so nothing here is ever accepted automatically, whatever the autopilot preference says.

### Answering

#### Context

See `## Context`.

#### Business logic

Picking an option posts the pick [4] against the question's own project, gate and agent [3], as the user. For a question the Claude web bridge [8] reported from a cloud session [7], the pick is instead queued on the daemon for the extension to type into that session; a refusal is shown as the reason. A post that fails leaves the card open and unanswered, with the failure's message shown in the card, and the heading's count unchanged.

### An answered question collapses and stays

#### Context

**Problem**: the daemon's next read drops a resolved gate, and a card vanishing under the cursor loses what was just picked.

#### Business logic

Once a pick [4] is accepted, the card collapses in place to one line (`AnsweredChoice.tsx`): a ✓, the question's title, the agent's label, and "Expand". "Expand" reveals the options with the picked one marked ✓ and the rest dimmed, inert, plus "Open session →" which still opens the agent [3]; "Collapse" folds them again. The answered card stays in the section, in place while the daemon still lists the gate [2] and after it stops listing it, until the page is reloaded: the memory of answers is per page load, so a reload starts clean. A gate the agent fires again is a fresh card.

### Order, count and the jump list

#### Context

**User story**: with many questions open, the user needs a map of them that holds still while the cards scroll.

#### Business logic

- Rows are the daemon's open questions [1] in its order, an answered one among them rendered collapsed in place, followed by the answered questions the daemon no longer lists.
- The heading counts only the open ones: answering drops the count at once.
- With more than one row, a jump list titled "Jump to a question" sits on the right, beside the scroll area, and stays put while the cards scroll: one row per card labeled by the agent's [3] label, with a ✓ and dimmed once answered. Clicking a row scrolls its card into view. A single card gets no jump list.
