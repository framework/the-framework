The committed per-run conversation transcripts (#908): the human turns and agent replies of a run as one markdown file per run under `.the-framework/conversations/`, kept in git so a clone carries the chat and not just the fact a run happened (#857).

## TLDR

- File format: `# Conversation <runId>` header, then one `## <ISO> · <role> · <via>` heading per message with an escaped multi-line body.
- Pure render/parse core (`renderMessage`, `parseConversation`) plus IO over the `StoreFs` seam: `appendMessage` (creates dir, header, and ignore rule as needed), `readConversation` (oldest-first), `listConversations`.
- `ensureConversationsIgnored` lazily upgrades `.the-framework/.gitignore` on append: repos activated before this feature carry the old three-line allow-list and would silently drop their own conversations; a gitignore we do not recognize is left alone.

## Decisions

- Deliberately not the verbose transcript — the tool-call-level log is left to the model provider (#857, same standing policy as run-store.ts). What lands is what a person would reread: what was asked and what came back.
- One file per run, not one shared file: run worktrees are live concurrently and each auto-commits its own pending work on teardown, so a shared file would merge-conflict whenever two runs chatted at once. The run id is the join key back to LOGS.md's `- run:` field (#898).
- Body escaping only escapes a line-leading `#` or `\` (entries are only ever started by a line beginning `## `), so multi-paragraph replies stay readable in a `git diff` — unlike LOGS.md, which collapses free text to one line.
- Parsing is forgiving: a malformed or torn block is skipped, never thrown; anything before the first `## ` (the header) is ignored.

## Facts

- Heading separator is ` · ` (middle dot U+00B7), matching LOGS.md; a heading carries exactly three fields — more means not one of ours.
- `via` must match `/^[A-Za-z0-9_-]+$/`; `isSafeVia` is checked at the boundary (not trusted) because #917 lets a surface name itself over the control channel, and a `via` carrying the separator, a newline, or `#` would forge structure in a line-parsed file — #897's threat model.
- Run ids are validated with `isSafeRunId` before becoming paths (`conversationPath` returns `undefined` on unsafe ids; append/read then no-op).
- `CONVERSATIONS_GITIGNORE` needs both entries (`!conversations/` and `!conversations/**`): the ignore file's `*` rule makes git skip the directory without descending, so un-ignoring the files alone would never be reached.
- `role` is who said it (`user` | `agent`); `via` is the transport (`dashboard`, `discord`, …).
