What the tests cover:

- **Scripted turns** - the turns answer in script order, the last one repeats once the script runs out, and every prompt is recorded in order.
- **A responder** - with a responder configured, each turn's answer is what the responder returns for the prompt and the turn's index.
- **Progress events** - a turn reports `start`, one `action` per scripted tool name, `text` and `result`, in that order, and answers with the driver session's id.
- **An attached text** - a prompt given an attached text (a text the caller hands the coding agent with that one prompt) is recorded as the prompt, then the attached text, then the added sentence when there is one, each after an empty line; its `start` event carries the prompt as given and names the attached text and the sentence apart.
- **Seeded files** - a seeded file is read by its path, and an unknown path is refused.
- **A stop request** - a turn on a driver session whose stop request is already raised fails.
