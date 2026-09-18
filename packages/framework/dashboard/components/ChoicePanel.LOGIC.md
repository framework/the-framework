The gate [1] as the dashboard renders it, the "Your call" card: the agent's [2] question with its options, answered one at a time or several at once, sent back as the pick [3] to the agent, after which the card waits disabled until the agent goes on and the card disappears. A pick the daemon refuses is said in the daemon's own words and the card stays answerable. The same card answers a cloud session's [5] question carried in by the Claude web bridge [6].

## Context

**User story**: an agent's turn ends on "Approve this plan?" with two options, so the agent ends waiting [4] on it. The user sees a "Your call" card, in the agent view's [7] right rail, in its transcript, or among the Overview's open questions [8], clicks an option or presses Ctrl+Enter for the recommended one, and the agent continues on that answer.

**Problem**: a gate reaches a card only when somebody is watching, so the card must make the answer unambiguous, saying what "Accept" will send and whether the pick has landed, and it must never let an answer go out twice.

## Glossary

[1] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] pick: the answer to a gate: the option or options the user chose.
[4] waiting: how an agent that ended on a question reads: not working, its checkout kept, resumed by the answer.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[7] agent view: one agent's page. the Overview: the dashboard's cross-project page at `/`.
[8] open question: a question nobody has answered yet, as the dashboard lists them across projects.

## Business logic — TL;DR

- **What the card shows** - the caption "Your call", the question, and the options: one button per option for a single pick, or a checklist with an "Accept …" button for a multi-select.
- **A single pick** - the recommended option is the filled button and carries "Recommended"; clicking any option sends that option at once.
- **A multi-select and its defaults** - boxes start checked as the agent marked them; the button reads "Accept N selected" or "Accept none", so sending nothing is a deliberate answer.
- **Ctrl+Enter accepts the recommended answer** - only on the active gate, the first of several; a single pick sends the recommended option (the first option when the agent named none), a multi-select sends the boxes as checked.
- **After the pick is sent** - "Sending your choice…", then "Choice sent — waiting for the agent to pick it up…" with everything disabled until the card disappears; a pick the daemon refused shows the daemon's reason as an alert and re-enables the options.
- **Where the pick goes** - to the daemon, addressed at the agent that asked, which hands the chosen labels to that agent; a bridged question's pick goes to the queue the extension types from. The card never answers by itself.

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

As soon as a pick [3] is sent, every option and the accept button are disabled. While the send is in flight the card says "Sending your choice…"; once the daemon has accepted it, "Choice sent — waiting for the agent to pick it up…". The card stays in that state until the agent goes on — its next event streams into the browser — at which point the surface that shows the card removes it (the rule that says which gates are open is in `lib/live-state.ts`); a surface that keeps a record of answered gates is told what was picked.

The daemon can refuse a pick: the gate is no longer open, the pick is not one of the gate's options, or the agent has ended and the project has no resume hook to continue it with. The card then shows the daemon's reason as an alert, shows no "Choice sent" line, tells no surface an answer was given, and enables the options again. A send that failed without a reason shows "Could not send your choice — try again.".

### Where the pick goes

#### Context

**Business logic story**: an agent [2] that ended on a gate [1] is waiting [4]; a cloud session [5] parked on a question is not an agent of this machine, and its answer is typed into claude.ai by the extension.

#### Business logic

By default the pick [3] goes to the daemon, addressed at the agent named for the card, as the ids of the chosen options. What the daemon does with it — reads the gate off the agent's own record, turns the ids into the options' labels, and hands them to the agent through its inbox while it works or through the project's resume hook once it has ended — is the daemon's (`src/dashboard-rpc/control.ts`). A card for a question the Claude web bridge [6] carried in is given another destination by the surface that shows it: the pick is queued for the extension to type into the cloud session. The card never answers on its own: no countdown runs in it.
