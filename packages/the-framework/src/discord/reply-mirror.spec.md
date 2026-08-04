The reply mirror: poll bound runs and post the agent's new conversation turns back to the Discord channel that asked.

## Decisions

- **The source is the committed conversation, not the event log**: the event log has no "agent reply" kind — its entries are rendered console lines and raw driver events, neither of which is the settled text a person actually read.
- **The channel is a recorded run→channel binding, not a guess** — bind time is the only moment the channel is known, and a dashboard-started session must never post into a channel that never asked.
- The baseline is taken at **bind time**, not at first poll — deferring it would swallow a reply from a fast agent that beat the first tick. Binding is awaitable, and the bot awaits it *before* handing the run the message.
- The cursor advances unconditionally, even when the bot is off or the turn is the user's own — a turn deliberately not posted must not be reconsidered forever. Only agent turns post: echoing the asker is noise, and a turn that came *from* Discord is already on their screen.

## Facts

- Binding release: a missing conversation (run archived, project gone) counts a miss, and enough consecutive misses drop the binding — counted rather than immediate, because a run bound the instant it started has no state on disk until its child boots. A *throw* is a transient read failure costing one poll; "gone" is what releases — the distinction is the whole mechanism.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
