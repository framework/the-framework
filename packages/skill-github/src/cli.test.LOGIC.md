What the tests cover, running the command in-process with gh scripted (and real git where the current branch matters):

- **A command line that cannot be read** - no command, an unknown command, an unknown flag, `merge` with a word for a number, `open` without `--title` and an unknown `--state` each print the usage on stderr and exit 2.
- **`requests`** - the flags become one gh listing (state `all` by default, `--branch` as the head, `--state` and `--since` applied), the rows come back as requests newest first, and a gh that cannot answer is the refusal `forge-failed` with gh's line, exit 1.
- **`open`** - on the current branch with the words given, `--merge` arming (the watcher started where the repository allows no auto-merge), the open request answered as `existing` on a second open, `--branch` naming another branch, `open-failed` with gh's line when GitHub refuses, `no-branch` on a detached working directory.
- **`merge`** - a draft is marked ready then armed, answered as `{ number, outcome }`; a merged request is the refusal `not-open` with its state and one line; an arming gh refuses is `merge-failed` with the detail.
- **`home`** - the project page and the forge's name from a GitHub origin; another host or no origin is the refusal `no-remote`.
