The live-chat message channel (#714): the user's own unprompted turns into a running run — the reverse of await gates (#337), where the agent asks the user.

## TLDR

- `RunMessages.takeQueued()`: the end-of-run drain (#1390) — the next message only if one already arrived, never waits; `undefined` on an idle or closed queue, which is what lets the session end itself.
- `RunMessages.next(signal)`: the stay-open wait, kept for a run whose own terminal dashboard is the single surface (it has no daemon to `--resume` through); resolves `undefined` when the run should stop waiting (signal aborted, or source closed).
- `RunMessageQueue`: the concrete implementation the control channel feeds via `push(text, via)` — a message with a parked waiter hands off directly, otherwise queues; FIFO in both directions. `close()` wakes every parked waiter with `undefined`.
- `ChatMessage.via` (#917) names the originating surface, traveling with the text rather than being read off the run: one run can be spoken to from more than one surface (dashboard-started, Discord-answered — one conversation with different-origin turns).

## Facts

- Each message continues the *same* agent session (`claude --resume <id>`), so the conversation keeps full context.
- Wired only when an interactive channel can deliver messages (live dashboard/daemon over `control.jsonl`); a headless run gets no `RunMessages`, so its loop ends when the agent stops asking — byte-identical to before this existed.
- `next()` removes its abort listener on resolution and de-registers a parked waiter on abort, so neither leaks.
- `takeQueued()` is `undefined` once closed even with messages pending: a closed queue is an aborted run, and a stale message must not start a new turn.
