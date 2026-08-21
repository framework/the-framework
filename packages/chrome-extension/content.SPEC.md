The extension's page half: injected into claude.ai session pages, it finds the question a parked session is waiting on, mirrors the transcript, types a delivered answer into the composer, and shows a status panel — never holding the token or talking to the daemon itself.

## Flows

- The question is the JSON options block an agent emits when it parks on a decision, brace-matched out of surrounding prose wherever the page hides it — code elements, shadow roots, split across highlighter spans.
- The page also renders the run's own prompt, which quotes that block's protocol — examples included — so the dashboard is never handed a decoy (#1568): nothing inside the transcript's opening message counts (that is the prompt rendering), a placeholder-shaped title is the protocol description talking (even when punctuation joins the placeholders), and the protocol's two literal examples are matched verbatim. The last real question among what survives wins.
- The transcript mirrors to the dashboard as per-message blocks when the page marks them, else as the visible conversation text read from the newest end — claude.ai's surrounding UI and the extension's own panel stripped out. Only what changed since the last look is sent.
- Delivering an answer is the one action taken: the answer the user picked in the dashboard is typed into the composer and submitted, after waiting out a slow page still rendering the composer. Only the top frame types, so nothing submits twice — and only a label the session itself offered can ever be typed.
- It re-reads on page mutation with a slow heartbeat backstop, and its collapsible panel reports every stage's status — found, sent, delivered, and why not.

## Rationales

- **Built to run in background tabs.** The tabs the bridge lives in are pinned and hidden, where the browser throttles timers — and the session's own stream changes the page whenever anything happens, so reacting to page mutations is immediate and the heartbeat is only a backstop.
- **Every stage reports.** A stage that fails silently is indistinguishable from a bridge with nothing to do.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
