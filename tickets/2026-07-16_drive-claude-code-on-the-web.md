priority: medium
topics: [the-framework]

# Drive Claude Code on the web instead of the CLI (MVP shortcut: free worktrees + PR, 0% local CPU)

## TLDR

Add a driver that runs tasks off the user's machine instead of via the local CLI. The spike killed the original browser ideas (extension / headless automation script an authed claude.ai page — barred by the Usage Policy, and the routines fire API has no read-back: session URL only, no status/transcript/output). The winning path is **GitHub Actions**: the official `anthropics/claude-code-action@v1` gives full control (`--dangerously-skip-permissions`, `--model`, `--append-system-prompt`), real read-back (`execution_file` transcript, `session_id`, `branch_name`, `structured_output`), runs on a subscription via `claude setup-token`, and fits the Driver seam unchanged — the daemon POSTs `workflow_dispatch`, polls, downloads the transcript (draft PR #934). CC-web driving itself: post-MVP.

## Why it matters

"0% CPU on my machine without needing a VPS — a massive USP": tasks parallelize essentially without limit, the laptop lid can close, and the web flow's worktree+PR dance comes for free (relates to #453). Known trade-offs: fresh runner per turn (minutes not seconds, continuity via the pushed branch), no mid-run Q&A (an AWAIT gate must end the run and re-dispatch with `--resume`), and cost moves to Actions minutes + one person's Claude quota. Idea on record: route small-scope prompts to the local machine and large-scope ones to GH Actions (the `## Analyze user prompt` step already distinguishes them). Also Rom's #1 dogfooding wish (#770).

## Source

Imported from GitHub issue [gemstack-land/the-framework#610](https://github.com/gemstack-land/the-framework/issues/610), created 2026-07-16, labels: `priority: medium`, `the-framework ♻️`, 8 comments.

### Original description

> Captured from team discussion. Flagged as a potentially large MVP shortcut. The mechanism (how we drive it) and session/login are open; needs a spike.

## Idea

Add a driver that uses Claude Code on the web instead of the Claude Code CLI. We drive the web UI programmatically and let it run the task, rather than running the CLI locally.

## Why it's a big shortcut

- Claude Code on the web already does the whole Git worktree dance and opens the GitHub PR. We reuse that flow instead of building it (relates to #453).
- It runs off the user's machine: roughly 0% local CPU, so AI tasks parallelize essentially without limit.
- It is where at least some of us already work day to day.

## How to drive it (open)

- **Chrome extension**: the first idea. Simple-ish, but an install plus configuration.
- **Headless browser automation**: drive the web UI in a server-side headless browser (no install, seamless). Could reuse the headless-streaming primitive from the preview capability (#609), though the purpose is different (driving the agent vs previewing the agent's browser).
- Decision pending; a spike should compare the two on the hard part below.

## The one hard part: session / login

- [ ] Confirm we can drive an authenticated Claude Code web session programmatically (headless or via extension). This is the main unknown and likely decides extension vs headless.

## Related

- #495 (BYOS): the CLI path for "use the user's own agent". This is the web analog.
- #453 (git worktrees): the web flow does this for us, reducing what we build.
- #609: a separate idea, but shares the possible headless-browser mechanism.
- #605 (daemon): where a server-side headless driver would run.

### Notes from the GitHub thread

- Spike answer on session/login: an authed session *is* drivable without cookies/anti-bot via two official paths on the same subscription — the routines fire API (`POST /v1/claude_code/routines/{trig_id}/fire`, per-routine `sk-ant-oat01-...` token, returns session id+URL but nothing else) and `claude --cloud` (interactive-terminal only, exits 1 when piped, so it can't sit behind the non-interactive driver).
- Correction that settled it: **GitHub Actions beats the routines API** on every ask — Auto mode (`--dangerously-skip-permissions`), model forwarding (`--model`, #628), trusted prompt (`--append-system-prompt`), and real read-back. Repo selection is per-dispatch (single-repo run token, or a multi-repo App token).
- Implementation: daemon triggers `workflow_dispatch` with a correlation id, polls for the run, downloads the transcript artifact, parses it into a turn (draft PR #934; needs a `CLAUDE_CODE_OAUTH_TOKEN` secret + workflow on the default branch).
- CC-web DOM-crawling idea stays on the table for later ("find the most visible textarea / scroll area" heuristics), but UX polish outranks both; GH Actions is the one to try.
