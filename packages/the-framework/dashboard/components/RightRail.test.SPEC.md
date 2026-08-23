What the tests cover: which tabs the right sidebar offers, and when it is shown at all.

- **A fixed width** — the sidebar holds the same width for every tab, including when a document the agent published pulls it to the Views tab and when the user switches away again.
- **No project, no sidebar.**
- **The Browser tab** is offered for an agent running on this machine with the browser preview on, and never for an agent running on a GitHub Actions runner, even when the preview was requested.
- **Hovering a tab** says what it holds.
- **Every tab is earned** — with no PLAN/TODO documents there is no Docs tab, and when nothing else qualifies either the sidebar itself disappears; a live agent that published a document keeps the sidebar even when every read comes back empty. While the first read is still out the Docs tab stays, so switching projects does not blink the sidebar out and back in.
- **When the launcher shows the documents in its main column**, the sidebar withholds the Docs tab and does not even read them, leaving the rest of the sidebar untouched — and shows no sidebar at all when documents were the only thing it had to offer.
- **A tab that loses its content** does not leave an empty panel: even after the user picked that tab by hand, the sidebar falls back to the first tab that still has content.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
