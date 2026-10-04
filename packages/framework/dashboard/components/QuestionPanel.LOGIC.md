The question an agent's [1] turn ended on (a gate [2]), asked as a panel above the message box of the agent's page: the title, one row per option, a row to answer in one's own words, and Skip / Submit.

## Context

**User story**: the agent stops on "Which database?" with two options. The user reads the question right above the box they type in, as Claude Code on the web asks one: they pick an option with a click or its number key and press Submit, or type their own answer in the "Other" row, or press Skip. The agent goes on with that answer.

**Business logic story**: an agent that stops on a gate does not stay alive: it ends waiting, and the answer resumes it (the daemon's side). An option's pick [3] is sent as a pick, which the daemon checks against the question still open and hands to the agent as the chosen labels. Words of the user's own, and a skip, are sent as the user's message, which resumes the agent like any message typed in the message box; nothing the user did not see is sent.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[3] pick: the answer to a gate: the option or options the user chose.

## Business logic — TL;DR

- **What the panel shows** - the question as its title; a row per option with its label, its one-line description and its number key; an "Other" row; a hint line; Skip and Submit.
- **One answer** - the recommended option starts picked; a click or a number key picks another; nothing is sent before Submit.
- **Several answers** - rows are checked on and off, starting from the gate's defaults; Submit sends the checked ones, none included.
- **"Other"** - the user's own words, sent as their message; with several answers, sent together with the checked options' labels.
- **Skip** - sends the user's message "I skip this question.".
- **Keys** - on the active panel, 1 to 9 pick a row and Ctrl+Enter submits; keys typed into another text field are left alone.
- **After sending** - the panel stays with its controls off, saying it waits for the agent; a refusal is shown in the daemon's words and the controls come back.

## Business logic

### What the panel shows

#### Context

See `## Context`.

#### Business logic

The panel is a card with round corners, centered at the transcript's column width (48rem at most), named for assistive technology by the question. From top to bottom:

- the question, as the card's title;
- one row per option, in the gate's [2] order: the option's label, the word "Recommended" after the label of the option the gate recommends, the option's one-line description under the label when it has one, and at the right the row's number, counted from 1. The picked row has the accent border and a tinted background;
- a last row, "Other": a text field whose placeholder reads "Other: say it in your own words", with the next number at its right;
- a red line with the reason, when the last send was refused;
- a bottom line: at the left a hint ("Number keys pick · Ctrl+Enter submits", on the active panel only) which gives way to the sending status; at the right the "Skip" and "Submit" buttons. The line is always there, so the buttons do not move.

### One answer

#### Context

See `## Context`.

#### Business logic

For a gate that takes one answer, exactly one row is picked at any time. The row picked at first is the option the gate recommends, or the first option when it recommends none. A click on a row, or the row's number key, picks it instead; putting the cursor in the "Other" field picks "Other". Picking sends nothing. "Submit" sends the picked option as the pick [3] for this gate, project and agent. While "Other" is picked and its field is empty or blank, "Submit" is off.

### Several answers

#### Context

See `## Context`.

#### Business logic

For a gate that takes several answers, each row has a check box and is checked on or off by a click or its number key, independently of the others. The rows the gate marks as defaults start checked. "Submit" sends the checked options as the pick, which may be none of them.

### "Other"

#### Context

**User story**: none of the options fits, and the user answers in their own words without leaving the question.

#### Business logic

When "Submit" is pressed with "Other" picked (one answer), the words in its field, trimmed, are sent as the user's message to the agent, not as a pick. For a gate that takes several answers, words in the field count whenever the field is not blank: "Submit" then sends one message made of the checked options' labels followed by the words, separated by a comma and a space ("Lint, and the type check"), and no pick. Pressing Enter in the field does what "Submit" does. Once the daemon has accepted the message, the page is told its text, so the transcript shows it at once as the user's message (`AgentView.tsx`). Since no pick is recorded, the transcript later shows the question as its text followed by the user's message (`EventList.tsx`).

### Skip

#### Context

**User story**: the user does not want to answer, and wants the agent to go on rather than wait.

#### Business logic

"Skip" sends the user's message "I skip this question." to the agent, the same way "Other" sends its words: the message resumes the agent, shows in the transcript as the user's message, and what the agent does next is the agent's call.

### Keys

#### Context

**Problem**: the message box sits right under the panel, and the user may be typing in it: a digit typed there must not change the pick.

#### Business logic

Only the panel the page marks active listens to the keyboard (the page marks the newest question, `AgentView.tsx`), and not once an answer is sent. A key pressed while the cursor is in a text field is not the panel's, with one exception: Ctrl+Enter (Cmd+Enter on a Mac) pressed in the panel's own "Other" field submits. Otherwise:

- a digit from 1 to 9 picks the option with that number (checks it on or off, for several answers); the digit after the last option puts the cursor in the "Other" field; a digit with no row does nothing;
- Ctrl+Enter (Cmd+Enter) does what "Submit" does.

### After sending

#### Context

**Problem**: the answer resumes the agent, which takes a few seconds; a panel that only greyed out would look broken, and one that could be pressed again would send twice.

#### Business logic

While a send is on its way the bottom line reads "Sending your answer…" and every control (rows, the field, Skip, Submit) is off. When the daemon accepts it, the line reads "Answer sent — waiting for the agent to pick it up…" and the controls stay off; the panel goes when the agent's page sees the agent go on. When the daemon refuses (the question is no longer open, the project has no resume hook), or the send fails, the reason is shown in red in the daemon's own words ("Could not send your answer — try again." when it gave none), nothing is reported as said, and the controls come back.
