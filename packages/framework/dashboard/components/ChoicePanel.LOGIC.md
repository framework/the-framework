The gate [1] as the dashboard renders it, the "Your call" card: the agent's [2] question with its options, answered one at a time or several at once, posted back as the pick [3] into the agent's control file [4], after which the card waits disabled until the agent's own resolution reaches the browser and the card disappears. The same card answers a cloud session's [5] question carried in by the Claude web bridge [6]; only where the pick goes differs.

## Context

**User story**: an agent stops at "Approve this plan?" with two options. The user sees a "Your call" card, in the agent view's [7] right rail, in its transcript, or among the Overview's open questions [8], clicks an option or presses Ctrl+Enter for the recommended one, and the agent continues on that answer.

**Problem**: a gate reaches a card only when somebody is watching, so the card must make the answer unambiguous, saying what "Accept" will send and whether the pick has landed, and it must never let an answer go out twice.

## Glossary

[1] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[4] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[7] agent view: one agent's page. the Overview: the dashboard's cross-project page at `/`.
[8] open question: a gate nobody has answered yet, as the dashboard lists them across projects.

## Business logic — TL;DR

- **What the card shows** - the caption "Your call", the question, and the options: one button per option for a single pick, or a checklist with an "Accept …" button for a multi-select.
- **A single pick** - the recommended option is the filled button and carries "Recommended"; clicking any option sends that option at once.
- **A multi-select and its defaults** - boxes start checked as the agent marked them; the button reads "Accept N selected" or "Accept none", so sending nothing is a deliberate answer.
- **Ctrl+Enter accepts the recommended answer** - only on the active gate, the first of several; a single pick sends the recommended option (the first option when the agent named none), a multi-select sends the boxes as checked.
- **After the pick is sent** - "Sending your choice…", then "Choice sent — waiting for the agent to pick it up…" with everything disabled until the card disappears; a failed post says "Could not send your choice — try again." and re-enables the options.
- **Where the pick goes** - to the named agent's control file, or the project's control log when no agent is named; a bridged question's pick goes to the queue the extension types from. The card never answers by itself.

## Business logic

### What the card shows

#### Context

See `## Context`.

#### Business logic

The card is captioned "Your call" and titled with the agent's [2] question. A gate [1] that asks for one answer shows one button per option, each with its label and, when the agent gave one, a one-line detail under it. A gate that allows several answers shows a checklist, each row a checkbox with the label and detail, followed by one "Accept …" button. In the right rail the card is a full-width section; in the transcript it is a rounded card in the flow; the behavior is the same in both places. A gate that is fired again with the same id starts the card over.

### A single pick

#### Context

**User story**: the agent asks "Approve this plan?" and recommends "Yes"; the user sees "Yes" as the filled button marked "Recommended" and "No" outlined, and clicks one.

#### Business logic

The option the agent recommended is the filled button and carries the word "Recommended" after its label; every other option is outlined. Clicking an option sends that option as the pick [3] at once; there is no separate confirm step.

### A multi-select and its defaults

#### Context

**User story**: the agent lists six findings and asks which to fix; the ones it suggests start checked, the user adjusts the boxes and presses "Accept 4 selected".

#### Business logic

Each option starts checked when the agent marked it as a default, unchecked otherwise; the user toggles boxes freely. The single button says what it will send: "Accept N selected" for N checked boxes, or "Accept none" when nothing is checked, so an empty pick [3] is a choice the user reads before making it. Pressing it sends the checked set, possibly empty.

### Ctrl+Enter accepts the recommended answer

#### Context

**Problem**: several gates [1] can be open at once in the rail, so one keyboard shortcut must be bound to exactly one of them.

#### Business logic

Only the active gate, the first in the rail, listens for Ctrl+Enter (or Cmd+Enter), and shows the hint "Ctrl+Enter to accept" while it can still be answered. The shortcut sends the recommended answer: for a single pick, the option the agent recommended, or the first option when it recommended none; for a multi-select, the boxes as they are checked at that moment. The shortcut does nothing once a pick [3] is being sent or has been sent.

### After the pick is sent

#### Context

**Problem**: between the click and the agent's acknowledgment the buttons must not invite a second answer, and a greyed card with no word on why reads as broken.

#### Business logic

As soon as a pick [3] is sent, every option and the accept button are disabled. While the post is in flight the card says "Sending your choice…"; once the daemon has accepted it, "Choice sent — waiting for the agent to pick it up…". The card stays in that state until the agent's resolution event streams into the browser, at which point the surface that shows the card removes it (the rule that closes gates off the event stream is in `lib/live-state.ts`); a surface that keeps a record of answered gates is told what was picked. If the post fails, the card shows "Could not send your choice — try again." and the options are enabled again.

### Where the pick goes

#### Context

**Business logic story**: an agent [2] parked on a gate [1] tails its control file [4]; a cloud session [5] parked on a question has no control file, and its answer is typed into claude.ai by the extension.

#### Business logic

By default the pick [3] is appended to the control file of the agent named for the card, or to the project's control log when no agent is named. A card for a question the Claude web bridge [6] carried in is given another destination by the surface that shows it: the pick is queued for the extension to type into the cloud session. Either way the pick records that a human made it. The card never answers on its own: no countdown runs in it, and an agent nobody is watching gets its recommended option from the daemon, not from this card.
