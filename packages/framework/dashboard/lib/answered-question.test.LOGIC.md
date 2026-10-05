Tests of `answered-question.ts`.

- **The driver's own sentence** - the sentence is made by `agent-driver`'s continuation prompt itself, not copied into the test, so a change of its wording there fails here; the question and the answer are read back out of it, for one pick, for several picks joined by commas, and for a question that holds quotes and a full stop.
- **Any other prompt** - a task, the skip message "I skip this question.", and the driver's sentence with more words after it are no answered question.
