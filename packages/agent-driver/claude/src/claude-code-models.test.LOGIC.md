What the tests cover, for listing the models Claude Code offers:

- **Reading the answer** - Claude Code's answer gives its models in its own order by id and name, with the "default" entry left out; other lines, lines that are not JSON and answers to another request are ignored; Claude Code's own error for the request is the failure, in words.
- **Asking Claude Code** - only the `initialize` request is sent, Claude Code runs with streamed JSON input, the listing answers the models, and the process is stopped after it answers.
- **No answer** - a Claude Code that never answers fails the listing on the timeout, and the process is stopped.
- **The person's own setup** - the driver lists the models with `--setting-sources project,local` when `skills` is off.
