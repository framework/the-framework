Runs the Claude web bridge's page half and its visit planner against synthetic claude.ai pages, so the reading, driving and writing of the page can be checked without a browser, an installed extension, or a live cloud session.

## What the tests cover

Finding the parked question, across every shape the block has been seen in:

- The question block found in a fenced code block, in a `pre` with no `code` inside, in a bare `code` element with no `pre` around it, indented differently than expected, split into per-token elements by a syntax highlighter, surrounded by ordinary prose, and hidden behind a shadow root.
- A page with no question block reports no question.
- The await protocol's own spec block, which renders on the page as part of the agent's prompt, never counts as a question — on its own, and when a real question follows it, in which case the real question wins.
- The protocol's two literal worked examples — the browser-handoff pair and the "Ship this?" approval pair — never count as questions.
- Everything inside the opening turn is the rendered prompt: decoys there are ignored while a real question in a later turn still wins, and a question-shaped block that exists only inside the opening turn is never reported.
- Every one of those cases also checks that the composer was located and that the panel shows the question's actual title.

What is reported to the daemon:

- The question reaches the daemon in the shape the session asked it: whether several answers may be picked at once, which options start ticked, and which option ends the session, alongside the labels and their detail text — while keys the daemon does not know are dropped rather than forwarded.

Mirroring the transcript:

- The mirror is one entry per conversation turn, under the position the page gives the turn: the user's turns as the user's, the session's as the session's, markers such as "Initialized session" left out, interface glyphs and blank lines removed, and the opening turn — the run's prompt — cut to its first 8000 characters.
- When only the recent part of the transcript is rendered, positions still come from the page, not from counting what is on screen.
- A page that marks no turns mirrors nothing, and the panel says that no transcript rows were found.

Typing the dashboard's answer back into the session:

- The composer is filled and the page's send button is clicked.
- With no send button on the page, the answer is submitted with an Enter keypress instead.
- A page with no composer is refused with that as the stated reason, rather than the text being typed somewhere else.

Creating a session:

- On a synthetic new-session page built like the live one was observed to be — combobox chips for the repository and the branch, each opening a searchable list of options, a composer and a send button that turns the page into a session address — the branch is chosen, the prompt typed, send clicked, and the new session's id reported, in each of the three states the page opens in: the requested repository already remembered, another repository remembered (re-picked through its chip), and none remembered (picked through the select-repository control).
- When the branch list does not offer the requested branch, nothing is sent and the outcome names the branch.
- A page with no repository picker is refused naming that control, and the probe describes the page's controls without touching them.

The panel: it folds down to a compact "TF" tab, dropping its rows and its full title, and unfolds with the question's details intact.

The Driver, on a synthetic app built like the live one was observed to be — a session list of links carrying the session id with a text status label beside each, a "Show more" button at the list's end and a decoy one deep in the middle panel, a "New" link, and in-app navigation that swaps the main area without a page load:

- The list is read by label — awaiting, unread, idle, running, landed, and an unknown label carried verbatim — paged through the list's own button and never the decoy, and a session absent from the list is reported missing.
- A cycle visits the sessions it was given in-app, reports the parked question from the awaiting one, types the queued answer into the other and counts it sent only once the page took the send, returns to the list, and keeps the overlay up — with its heading, its debug log naming the visits, and the panel hidden; the overlay comes back after being removed.
- An answer the page did not take is reported as failed, naming what the page did, never as sent.
- A session missing from the list is not visited and its answer is not claimed.
- The session the worker asked for is created first, from the list page, before the visits, and the cycle still ends on the list.
- A second instruction while a drive runs is refused as busy, and the drive completes.
- A status word on a row beats its pull-request label.

The visit planner: a parked session is visited when never seen, when its status changed, and again after five minutes; a queued answer forces a visit whatever the status; idle, running, landed and missing sessions are never visited on their own.

## Rationale

What this deliberately does not cover is the one thing left: whether claude.ai's real page puts the question block somewhere these strategies reach. Only loading the extension against a live session answers that.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
