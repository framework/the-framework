Mirrors a session's answers back to the Discord channel that asked (#932): polls bound runs' committed conversations and posts new agent turns.

## TLDR

- `startDiscordReplyMirror` keeps a `runId -> {channelId, next, misses}` map; `bind` adopts the transcript as it stands (posts only what is said from here on), `poll` (every 3 s, exposed for deterministic tests) posts each new agent-role turn via the injected `post`, `unbind`/`stop` tear down.
- The source is the committed conversation (#908), not the event log: `events.jsonl` has no "agent reply" kind — `log` is rendered console lines, `driver` is raw driver events — while a conversation turn is exactly the settled text the user read.
- The channel is a binding, not a guess: the bot records it when it starts or messages a run, the only moment the channel is known; an unbound (e.g. dashboard-started) run is simply not mirrored (routing that generally is #606's job).

## Problems

- Baseline race: taking the baseline on the first poll instead of at bind time would swallow a reply from an agent fast enough to answer before the first tick — so `bind` is awaited (and called before the run gets the message).
- Binding leak (#941): every chat-touched run used to stay in the map for the daemon's lifetime, each poll scanning every project's live metas per bound run. A run that stops resolving (`readConversation` → `undefined`: archived / project gone) is dropped after `UNBIND_AFTER_MISSES` = 10 consecutive misses — generous on purpose, since a run bound the instant it started has no live meta on disk until its child process boots, and dropping it in that window would silently unmirror a live chat. A throw is only a transient read failure and costs one poll.

## Decisions

- While the bot is switched off the cursor still advances without posting (same contract as the notification watchers): turning it on starts from now instead of flushing the backlog.
- The cursor advances first and unconditionally — a turn deliberately skipped (bot off, user's own message echoing back) must not be reconsidered next poll.
- Only agent-role, non-empty turns are posted: echoing the user's message back is noise, and a turn that arrived *from* Discord is already on their screen.
- `enabled()` is read once per poll (it gates posting, not observing); overlapping polls are prevented by a `running` flag.
