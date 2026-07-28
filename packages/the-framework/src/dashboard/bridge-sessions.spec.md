Selects which cloud (Claude web) sessions the bridge extension should keep a tab open for (#1237): recent `target: 'web'` runs with a `sessionId`, deduped, newest first.

## Decisions

- Recency (12h window, max 3 tabs) is the *whole* filter, necessarily: #1231 ends a web run at the hand-off, so every one reads `done` whether its cloud session is parked on a question or long finished — there is no liveness read-back, so "recent, and not many" is the honest rule.
- The tab cap exists because a browser quietly accumulating tabs is worse than a bridge missing an old run.

## Facts

- Session URL is `https://claude.ai/code/<sessionId>`.
