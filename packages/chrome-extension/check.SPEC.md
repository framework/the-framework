Runs the Claude web bridge's page half against synthetic session pages, so its reading and writing of the page can be checked without a browser, an installed extension, or a live cloud session.

## What the tests cover

Finding the parked question, across every shape the block has been seen in:

- The question block found in a fenced code block, in a `pre` with no `code` inside, in a bare `code` element with no `pre` around it, indented differently than expected, split into per-token elements by a syntax highlighter, surrounded by ordinary prose, and hidden behind a shadow root.
- A page with no question block reports no question.
- The await protocol's own spec block, which renders on the page as part of the agent's prompt, never counts as a question — on its own, and when a real question follows it, in which case the real question wins.
- The protocol's two literal worked examples — the browser-handoff pair and the "Ship this?" approval pair — never count as questions.
- When the page marks its messages, everything inside the opening message is the rendered prompt: decoys there are ignored while a real question in a later message still wins, and a question-shaped block that exists only inside the opening message is never reported.
- Every one of those cases also checks that the composer was located and that the panel shows the question's actual title.

What is reported to the daemon:

- The question reaches the daemon in the shape the session asked it: whether several answers may be picked at once, which options start ticked, and which option ends the session, alongside the labels and their detail text — while keys the daemon does not know are dropped rather than forwarded.

Typing the dashboard's answer back into the session:

- The composer is filled and the page's send button is clicked.
- With no send button on the page, the answer is submitted with an Enter keypress instead.
- A page with no composer is refused with that as the stated reason, rather than the text being typed somewhere else.

The panel: it folds down to a compact "TF" tab, dropping its rows and its full title, and unfolds with the question's details intact.

## Rationale

What this deliberately does not cover is the one thing left: whether claude.ai's real page puts the question block somewhere these strategies reach. Only loading the extension against a live session answers that.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
