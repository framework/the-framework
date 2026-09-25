The tool behind the end-to-end stories' start and resume hooks [1]: a stand-in for whatever a real project's hooks file names. It does what such a tool does, offline: it answers the agent's [2] id at once and leaves the agent to a detached process of its own, which makes the agent's checkout [3], drives `agent-driver`'s scripted fake driver with the real session log and the real inbox [4], records the agent on the `agent-data` branch through the `logs` skill, and reclaims the checkout by the branches rule. So every file the dashboard reads is written by the same code a real agent's tool writes it with; only the coding agent is scripted.

## Glossary

[1] start hook / resume hook: the one shell line under `start`, and the one under `resume`, in a project's `.the-framework/hooks.yml`; each answers the agent's id as JSON on stdout.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory.
[4] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[5] card / diary: an agent's record in the `logs` skill's two shapes: the card `<id>.json` and the diary `<id>.jsonl`, under the checkout's `.the-framework/` while the agent has a checkout, on the `agent-data` branch once recorded.

## Business logic — TL;DR

- **Start** - mints an id from the current time, writes down what its environment carried, spawns the agent's process detached and answers the id; a prompt containing "refuse" fails instead, with one line on stderr.
- **Resume** - writes down the agent's id and the text or the answer it was handed, spawns the continuation detached and answers the id.
- **The agent's process** - a checkout, a card naming this process and machine, one scripted session with the inbox, the end status, the record, the reclaim.
- **The continuation** - the kept checkout, or a new one on the agent's branch with the recorded diary put back; the prompt is the text, or the continuation of the recorded question with the answer.
- **The prompt scripts the agent** - "hold" waits for a go file, "ask" ends the first turn on a question, "commit" commits a file.

## Business logic

### Start

#### Context

See the intro. The harness writes each fixture project's hooks file with `start: node <this tool> start` and `resume: node <this tool> resume`.

#### Business logic

`start` reads `PROMPT`, `DRIVER` and `MODEL` from its environment and mints the agent's id from the current time. When a recording file is named in the environment, it appends one line with the hook, the id, the prompt and the picks: the only place a story can see what the hook was handed. A prompt containing "refuse" prints "the project has no such command" on stderr and exits 1. Otherwise the agent's process is spawned detached with the same environment and `{ok, id}` is printed.

### Resume

#### Context

See the intro.

#### Business logic

`resume` reads `RUN_ID` and `TEXT` or `ANSWER`, records them the same way, spawns the continuation detached and prints `{ok, id}`.

### The agent's process

#### Context

See the intro.

#### Business logic

The agent's checkout [3] is created through the branches skill, and its `.the-framework/` is hidden from git in that checkout alone, by a `.gitignore` of `*` unless the project tracks one there, so the tree stays clean. The card [5] starts with the id, the start time, the prompt, the driver (`DRIVER`, else "fake"), the model when given, the branch, and this process's id, this machine and the checkout path as the caller. One session of the fake driver runs the prompt with the inbox [4] in the checkout, so a line waiting when the turn ends becomes a further turn; each turn answers "done: <what it was told>". A SIGINT or SIGTERM aborts the session. The agent ends `stopped` when aborted, `failed` when the session threw, `waiting` when its last turn ended on a question, else `done`. The branch the checkout is on is written on the card, the log is closed with the status, the card and the diary are recorded on the `agent-data` branch, and, unless the agent is waiting, the checkout is reclaimed by the branches rule with a push allowed.

### The continuation

#### Context

See the intro.

#### Business logic

The agent's recorded card is looked up; none is an error. The checkout the agent kept is used when it exists; otherwise a checkout is attached to the agent's branch and the recorded diary is put back into it, so the log continues it. The prompt is the text; or, for an answer, `agent-driver`'s continuation prompt built from the title of the last question in the recorded diary and the answer. The card continues as it was, with this process and machine as the caller, and the session resumes the conversation; everything after is as for a fresh agent, except that no question is scripted and nothing is committed.

### The prompt scripts the agent

#### Context

A story needs an agent that is certainly still working, one that asks, and one that leaves work to push.

#### Business logic

A prompt containing "hold" makes the agent wait, before its first turn, until a file named `go` appears under its checkout's `.the-framework/`, or until it is stopped. A prompt containing "ask" makes the first turn of a fresh agent end on the question "Which way?" with the options "Left" (recommended, with a detail line) and "Right". A prompt containing "commit" makes a fresh agent write `work.txt` and commit it before its turn, so its branch holds work to push.
