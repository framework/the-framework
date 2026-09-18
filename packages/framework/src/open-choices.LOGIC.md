The one rule for which questions [1] an agent [2] still waits on, read off the agent's events. Every surface that offers an answer uses it — the agent's page, the questions hub, and the write that delivers the answer — so none offers what another would refuse.

## Context

**User story**: an agent's turn ends on a question; the agent ends `waiting` and its question stays answerable on its page and in the questions hub until the user answers, however long that takes. Once the agent goes on, the card is history.

**Problem**: a question used to close at the agent's end, because an agent that died holding a question has nobody left to read the pick. An agent that ended ON its question is the opposite case: the end is the wait.

## Glossary

[1] question: what an agent's turn ended on, asking the user to choose between options; the agent ends `waiting`, its checkout kept, and the answer resumes it.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.

## Business logic

The events are read in order. A question [1] opens when it is asked, whole: its id, title, options, recommendation and whether several may be chosen; asked again under the same id, the later one replaces the earlier in place. Every open question closes when the agent [2] goes on, that is at any later event of the agent's own (something it said, did or reported), because the answer, or the user's message, began a new turn. Every open question closes when the agent ends for good: done, stopped or failed. An end that says `waiting` closes nothing. What is left, in the order asked, is what the agent still waits on.
