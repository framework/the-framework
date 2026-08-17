The extension's page half: injected into claude.ai session pages, it finds the question a parked session is waiting on, mirrors the transcript, types a delivered answer into the composer, and shows a status panel — never holding the token or talking to the daemon itself.

## TLDR

- The question is the JSON options block our agents emit, brace-matched out of surrounding prose wherever it hides — code elements, shadow roots, split across highlighter spans — and the page's rendered copy of our own protocol is a decoy three ways (#1568): nothing inside the transcript's opening message counts (that is the prompt rendering, examples included), a placeholder-shaped title is the spec talking even when punctuation joins the placeholders, and the protocol's two literal examples are matched verbatim; the last real question among what survives wins.
- The transcript mirrors as per-message blocks when the page marks them, else as the visible conversation text from the newest end (application chrome and our own panel stripped); only what changed since the last look is sent.
- Delivering an answer is the one action taken: the pick is typed into the composer and submitted, after patiently waiting for a slow page to render the composer; only the top frame types, so nothing submits twice — and only labels the session itself offered can ever be typed.
- It re-reads on page mutation with a slow heartbeat backstop (built to run in background tabs), and its collapsible panel reports every stage's status — found, sent, delivered, and why not — because silent failure was the recurring failure.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
