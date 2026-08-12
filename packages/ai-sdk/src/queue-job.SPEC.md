Lets a caller queue an agent prompt to run later on a worker, with success/failure callbacks and optional live progress broadcast to a channel.

## TLDR

- A fluent builder collects the queue name, delay, callbacks, and an optional broadcast channel, then hands the job to the queue adapter the application registered at startup; sending without one fails with a clear message.
- Without a channel the job simply runs the prompt; with one it streams the run, pushing each chunk and then the final result (or an error) to subscribers, with an optional event-name prefix to avoid clashing with other traffic on the channel.
- Failures invoke the failure callback when set, otherwise they propagate to the queue's own error handling.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
