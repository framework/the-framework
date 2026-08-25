Priority: 5
Topics: [bug]
GitHub: [#1697](https://github.com/framework/the-framework/issues/1697)

# A model choice is silently dropped on web runs

## TLDR

A run started with an explicit model (`--model`, or the dashboard's model pick) that lands on the web path runs on whatever model claude.ai defaults to, and nothing says so — the choice is accepted, then dropped. The mechanism, traced on main `619e886e`: `cli.ts:1254` puts `model` into the shared agent options and the local driver honours it, but `driver/cloud.ts:206` asks the daemon for a session with `{ repo, branch, prompt }` only. `dashboard/bridge-starts.ts` queues exactly those three fields, and the extension's `content.js` `createSession` picks the repo chip, picks the branch chip, fills the composer and sends — it never touches claude.ai's model picker. `claude --cloud` did pass `--model` through; the extension path (#1693) never had it, so the gap arrived with #1694.

Two directions proposed on the issue:

- **Option 1 — drive the picker.** Carry `model` through `/_web-start` → the start-queue → `tf-create-session`, and have `content.js` select it in claude.ai's model menu before sending. Honours the choice, at the cost of one more guessed selector on someone else's UI — the fragile kind (every chip selector in `createSession` already reports rather than assumes).
- **Option 2 — say it is ignored.** Leave the session on the account's default and mark it on the run: a `session` event with no `model` already renders as "unknown" (#1438), so the honest minimum is a note on the run ("web runs use claude.ai's default model") plus the dashboard not offering a model pick for a web run.

Option 2 is the cheap, honest baseline; option 1 can come on top if the default model turns out to matter for fan-out runs — the Opus-by-default rule for dogfood runs makes that likely.

## Why it matters

A silently ignored option is worse than an unsupported one: the run looks like it honoured the choice, and whatever comes out gets attributed to a model that never ran. It sits directly on the path the project is investing in — driving web runs through the extension (#1328, closed as done 2026-08-24) is the chosen direction for CC-web sessions, and #1694 removed the `--cloud` path that used to carry `--model`.

## Source

Imported from GitHub issue [framework/the-framework#1697](https://github.com/framework/the-framework/issues/1697), created 2026-08-24, labels: `bug`, 0 comments.
