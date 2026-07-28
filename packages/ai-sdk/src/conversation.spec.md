`MemoryConversationStore` — the in-memory reference `ConversationStore` (Map-backed create/load/append/setTitle/list/delete).

## Facts

- `list(userId?)` filters by `meta.userId`, sorts by `updatedAt` descending, and reports `agent` and `userId` from meta — the `userId` is surfaced specifically so the resume-by-id owner check (#984) can see it.
- `load`/`append`/`setTitle` throw on unknown ids; `load` returns a copy of the messages array.
