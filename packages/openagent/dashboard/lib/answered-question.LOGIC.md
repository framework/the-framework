Tells whether a prompt of an agent's [1] transcript is the fixed sentence that resumes the agent with an answer picked for its gate [2], and reads the question and the answer out of it.

## Context

**User story**: the user picks "Red" in the panel of the question "Which color do you prefer?" (`components/QuestionPanel.tsx`). In the transcript the user reads the question and "Red" under it, in a small box, and not a sentence they never typed (`components/EventList.tsx`).

**Business logic story**: an agent that stops on a gate [2] ends waiting. A pick [3] resumes it with one fixed sentence that the tool running the agent writes (`agent-driver`'s continuation prompt): `You paused to ask: "<question>". The user chose: <answer>. Continue with that decision.`. The sentence reaches the transcript as a prompt, the same kind of event as the user's own messages, so only its wording tells it apart.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, and the answer resumes it.
[3] pick: the answer to a gate: the option or options the user chose.

## Business logic — TL;DR

- **The sentence, whole** - a prompt that is exactly `You paused to ask: "<question>". The user chose: <answer>. Continue with that decision.`, with nothing before it and nothing after it, is an answered question: its question and its answer are given back as written, each of any length and over several lines.
- **Any other prompt** - a prompt worded any other way is no answered question: a task, a message of the user's, the skip message "I skip this question.", and the sentence with more words after it.
- **Where the question ends** - the question ends at the last `". The user chose: ` of the prompt, so a question that holds quotes and full stops is read whole; an answer that itself holds those words is read as part of the question.
