What the tests cover:

- **Streaming and the final turn** - each output line goes through the driver's parser and its progress events are forwarded as they come; the turn opens with a `start` progress event, closes with a `result` one, and resolves with the parser's final result.
- **A coding agent that exits before reading its prompt** - the broken input pipe fails the turn cleanly on the non-zero exit instead of crashing The Framework's process, both with a simulated pipe and with a real process that exits at once while being fed a prompt larger than the pipe's buffer.
- **Nothing reported after a stop** - once a stop request has failed the turn, the killed process's later exit produces neither an `error` nor a `result` progress event.
- **A non-zero exit, said once** - the reason the coding agent gave is the last progress event, an `error`; the turn fails with "<driver id> exited (<exit code>): <reason>", and the same failure gives "<driver id> exited (<exit code>)" and the reason apart.
- **A coding agent held in conversation** - a parser that converses writes its own lines to the coding agent as it reads the output, the prompt is not written for it, and standard input stays open until the parser closes it.
- **A failed turn with a clean exit** - a turn whose output the parser says failed fails even though the process exited 0, as "<driver id> failed: <reason>", and "<driver id> failed" apart; one that failed without a reason fails with "the turn did not finish", never with the partial text it streamed.
