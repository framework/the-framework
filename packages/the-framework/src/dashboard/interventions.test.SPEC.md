What the tests cover: building the cross-project interventions list, and how each item is identified.

- **Open pull requests** - non-draft open pull requests from every registered project are pooled, newest first; a project with none contributes nothing; the same pull request reached through two projects registered on the same repository appears once.
- **Drafts** - a hand-opened draft is left out, a draft on an agent branch is kept (that is how the handoff hands work back), and a draft whose source branch is unknown is treated as hand-opened rather than admitted.
- **Agents parked at a gate** - a running agent with an unresolved gate becomes an item carrying the gate's question and its identity; an agent that is no longer running does not, even if it still records a gate; the item links to the dashboard when the daemon knows its address and carries no link otherwise.
- **Unpushed work** - a finished agent whose branch still holds commits becomes an item naming the task, the branch and the commit count; it does not when the work was already pushed, already merged, wrote nothing, has no branch left, or has nowhere to push; a still-running agent never counts; an unreadable branch is skipped rather than failing the list; and only the most recent finished agents are inspected, newest by start time.
- **Mixed kinds** - pull requests and parked agents appear in one list ordered newest first.
- **Which projects were read whole** - a project whose pull request listing or live-agent read failed is not reported as read whole, even though whatever it did contribute is still shown; a project that genuinely answered with nothing is reported as read whole.
- **Item identity** - a pull request is identified by its link, a parked agent by its project and gate, and unpushed work by its project and agent, so each notifies exactly once and the three kinds never collide.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
