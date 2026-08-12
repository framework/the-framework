Posts a session's answers back to the Discord channel that asked, turning the chat surface from write-only into a conversation.

## TLDR

- The source is the committed conversation — the settled text a person actually reads — not the raw event stream, which carries no "agent reply".
- Which channel gets the answers is a recorded binding, made when chat starts or messages a session; a session nobody bound (say, dashboard-started) never posts into a channel that didn't ask.
- The baseline is taken at bind time, so no backlog is ever replayed into a channel — and an answer that lands before the first check still counts as new.
- While the bot is off the cursor keeps advancing without posting, so turning it on starts from now.
- Only the agent's side is posted, each answer at most once; a failed delivery is logged, never retried into a duplicate.
- A binding whose session stops resolving (archived, project removed) is released after several consecutive misses — counted, so a just-started session that hasn't written its state yet is not dropped.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
