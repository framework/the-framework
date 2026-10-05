Draws the line of an agent's [1] transcript that says what is set up for the agent before it begins. While the session is being set up, it is one moving line naming the step going on now. Once set up, it is one folded grey line, "Session set up", which opens to the steps that were done: the agent's checkout, its branch, the branch it was started from when that is not the main branch, and the coding agent [2] that was started.

## Context

**User story**: the user starts an agent and, under their first message, reads what the tool is doing at this moment and for how long: "Starting session", then "Making the checkout", then "Starting Claude Code". A start that takes long never looks stalled, and the user knows which step takes the time. Once the agent has begun, the user reads one grey line saying the session was set up, as Claude Code on the web opens a session with "Initialized session". The user opens it to see where the agent works (the folder of its checkout), on which branch, and which coding agent and model were started. A user who picked "My local branch" in the launcher reads there that the agent started from that branch, and not from the project's main branch. Nothing the tool did before the agent's first step is hidden.

**Business logic story**: the facts are read off the agent's card [3], which the dashboard reads again with the project's agents. The tool that runs the agent writes the card as it goes, so the moving line goes from one step to the next by itself, and the folded line fills in and changes in place: the branch's name when the agent renames its branch, the model once the coding agent says which one it runs.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] card: the small file the tool that runs an agent keeps beside the agent's diary, saying how the agent stands: its status, its branch, the folder of its checkout, the coding agent and the model it runs.

## Business logic — TL;DR

- **One moving line while the session is being set up** - moving dots, the step going on now ("Starting session", "Making the checkout", "Starting Claude Code") and the seconds since the prompt; no chevron, nothing to open.
- **One folded line** - once set up, "Session set up" with a chevron; a click opens a bordered box, a click again folds it.
- **What the box says** - a row with a green check per step that was done: the checkout's folder, the branch, the coding agent and its model; and a sentence naming the branch the agent was started from when its card [3] names one; a fact the card does not say is no line.
- **Nothing known: plain words for an agent at work, else nothing** - once set up, a card that says none of the three draws the words "Session set up" with nothing to open for an agent at work on this machine, and no line at all otherwise.

## Business logic

### One moving line while the session is being set up

#### Context

See `## Context`.

**Problem**: between the user's Start and the agent's first output, the tool makes a checkout and a branch and starts the coding agent [2], which can take many seconds. One word, "Starting…", for all of it does not say which step is going on.

#### Business logic

The transcript says when the session is being set up, and gives the moment its prompt was written when it knows it (`EventList.tsx`). The line is then drawn like the transcript's moving last line (`ToolCalls.tsx`, "The line going on now"), and is announced to assistive technology as a status. It is no button and opens nothing. It holds, in order:

- three small dots rising one after the other, over and over;
- the step going on now, grey with a band of light crossing it, over and over;
- the time since the given moment, counted up every second, as "9s" below one minute and "1m 5s" from then on. With no moment given there is no count.

The step is read off the card [3]:

- "Starting session" while the card names neither a coding agent, nor a branch, nor a checkout (a card not listed yet says nothing);
- "Making the checkout" once the card names the coding agent and names neither a branch nor a checkout; an agent that runs elsewhere (on GitHub Actions, in the cloud, on another device) has no checkout made on this machine, so its line stays "Starting session" here;
- "Starting Claude Code" once the card names a branch or a checkout. The name is the coding agent's ("Claude Code", "Codex"; a coding agent the dashboard has no name for reads as the card names it), and reads "Starting the coding agent" when the card names none.

### One folded line

#### Context

See `## Context`.

#### Business logic

Once the session is set up, the line is grey, in the page's own font, drawn like the folded line of the coding agent's tool calls (`ToolCalls.tsx`): the words "Session set up" and a chevron pointing right. It starts folded. A click opens a box with a border and round corners under it and turns the chevron to point down; a click again folds the box away. Where the line sits in the transcript is the transcript's rule (`EventList.tsx`).

### What the box says

#### Context

See `## Context`.

#### Business logic

The box holds up to four lines, in this order. Three are a step that was done: a green check, what was done in the dark text color, then what it made in grey, cut with an ellipsis when it does not fit and whole in a tooltip. The third is a sentence, with no check:

- "Made the checkout" and the folder of the agent's checkout, when the card [3] says it;
- "Made the branch" and the branch's name, when the card says it;
- "Started from the branch <name>, not from the main branch.", the name in the dark text color, the sentence cut with an ellipsis when it does not fit and the name whole in a tooltip, when the card names the branch the agent was told to start from (`base`). The tool that starts an agent writes it only for an agent told where to start: one started from the launcher's "My local branch" option, and a subagent, which starts from its main agent's branch. An agent started from the project's main branch has no such line;
- "Started Claude Code": "Started" and the coding agent's [2] name ("Claude Code", "Codex"; a coding agent the dashboard has no name for reads as the card names it), followed by the model when the card says one. The model reads by the name its coding agent lists it under ("Opus 5.5"), and by its id while that list is not known or does not hold it (the naming rule in `lib/models.ts`).

### Nothing known: plain words for an agent at work, else nothing

#### Context

**Problem**: a card just listed may say nothing yet, and an agent whose card is not listed has no facts at all. A line that opens to an empty box would say something was set up and show nothing.

**Problem**: the agent's first row can reach the transcript before its card was read. A line drawn only once the card says something landed a moment after that row, pushing it down.

#### Business logic

Once the session is set up, when the card says neither a checkout, nor a branch, nor a coding agent:

- for an agent at work, as the transcript says (`EventList.tsx`), that does not run elsewhere, the component draws the words "Session set up", grey, in the page's own font, with no chevron: it is no button and opens nothing. The agent's first row is there, so its session was set up. When the card says one of the three, the words become the folded line, a button, in place;
- for an agent that runs elsewhere (on GitHub Actions, in the cloud, on another device), whose card may never say any of the three, and for an agent not at work, the component draws nothing.

While the session is being set up, the moving line is drawn whatever the card says.
