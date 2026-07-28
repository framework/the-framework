Tests for declarative conversation auto-persist (`conversational()`, `conversation-persistence.ts`) and the resume-by-id owner check (#984).

## TLDR

- `resolveAutoPersistSpec` precedence: per-call `false` wins, per-call object replaces class spec, async class returns awaited, spec lacking both user and id → null.
- Auto-persist on `prompt()`: first call creates a thread and stamps `response.conversationId`; the next call for the same (user, agent class) resumes the most-recent thread; different agent classes get distinct threads; `historyLimit` caps loaded history; missing `ConversationStore` throws.
- Streaming variant: persists after the stream drains; `conversational()` is invoked exactly once per `stream()` call (re-calling would repeat DI/DB side effects and leave an unhandled rejection).
- Explicit `forUser()`/`continue()` override the class declaration.
- Owner check (#984): resuming another user's thread rejects with `ConversationOwnershipError` before any provider call or append; the error carries `conversationId` + the attempted `userId` but never names the real owner; streaming refuses before any chunk.

## Facts

- Ownerless (pre-#984) threads stay resumable by bare `continue()` or any user; a bare `continue()` on an owned thread is refused with a hint to chain `forUser(ownerId)`.
- The check reads owners off `store.list()` entries: a store that omits `userId` keeps old permissive behavior (must not fail closed), while a store whose `list()` only answers scoped queries refuses instead of failing open.
- `AiFake` captures `messages` by reference, so assertions on captured calls stick to user-side messages for stability.
