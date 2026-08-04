The shared gate/choice/chat machinery: park a run on an agent question, resolve it from a human (or defaults), and run the live-chat phase.

## TLDR

- `resolveAwaitGate` emits the `choice` event, parks, and maps picked option ids back to labels for the continuation prompt.
- `drainGates` is the **single** gate loop shared by the opening prompt, each chat message, and the build flow's gate hook — they differ only in how a turn is continued. One loop is what stopped per-turn signal handling from needing three hand-kept copies.
- `runAwaitRounds` handles the opening exchange (gates + rounds), `runChatPhase` the live chat afterwards.

## Decisions

- Round 0 keeps a stable gate id; later rounds get unique ids — so a dashboard never confuses a re-ask with the answer it just resolved.
- Chat lifecycle: by default the loop only *drains* queued messages and the session ends on an idle queue (a follow-up reopens it via resume); `stayOpen` parks indefinitely only for a run whose own terminal dashboard is the single surface, since it has no daemon to resume through.
- A declined confirmation aborts the run through a dedicated controller — distinct from a stop.

## Facts

- Unattended runs disable gates entirely (nobody is there to answer); headless direct-prompt runs resolve gates to defaults and continue.
- The "exhausted rounds" outcome is reported from the last chat turn, not the opening prompt's round cap.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
