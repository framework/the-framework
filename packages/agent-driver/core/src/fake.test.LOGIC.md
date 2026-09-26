What the tests cover:

- **Scripted turns** - the turns answer in script order, the last one repeats once the script runs out, and every prompt is recorded in order.
- **A responder** - with a responder configured, each turn's answer is what the responder returns for the prompt and the turn's index.
- **Progress events** - a turn reports `start`, one `action` per scripted tool name, `text` and `result`, in that order, and answers with the driver session's id.
- **Seeded files** - a seeded file is read by its path, and an unknown path is refused.
- **A stop request** - a turn on a driver session whose stop request is already raised fails.
