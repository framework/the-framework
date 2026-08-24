What the tests cover: the session start-queue that web runs fill and the browser extension drains.

- A queued request carries its repository, branch and prompt and starts as queued.
- A repository that is not `owner/name`, that contains extra path segments, dot-only segments or shell syntax, is refused; a leading dot in a real repository name passes.
- A branch containing spaces or shell syntax, an empty branch, or an absurdly long one is refused; a run's own hand-off ref passes.
- An empty prompt or one past the cap is refused, while a prompt as long as a whole hand-off framing passes.
- Claiming hands out the oldest request first and each request only once; a claim nobody reported on is honoured while fresh and offered again once expired.
- A success records the session id and its URL; a success naming no session is recorded as a failure; a failure keeps the extension's note.
- Only a request that is currently claimed can be settled — a report on a queued or unknown request changes nothing.
- The queue is one per daemon, and can be reset for tests.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
