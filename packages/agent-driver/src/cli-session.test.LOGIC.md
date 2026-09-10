What the tests cover:

- **Streaming and the final turn** - each output line goes through the driver's parser and its progress events are forwarded as they come; the turn opens with a `start` progress event, closes with a `result` one, and resolves with the parser's final result.
- **A coding agent that exits before reading its prompt** - the broken input pipe fails the turn cleanly on the non-zero exit instead of crashing The Framework's process, both with a simulated pipe and with a real process that exits at once while being fed a prompt larger than the pipe's buffer.
- **Nothing reported after a stop** - once a stop request has failed the turn, the killed process's later exit produces neither an `error` nor a `result` progress event.
