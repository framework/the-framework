Conversation auto-persist helpers: resolve the effective conversational spec, load-or-create the thread (with the #984 ownership check), run the continuation-validate hook, and wrap the agent loop so history loads before and the new turn appends after.

## TLDR

- `resolveAutoPersistSpec(agentDecl, perCall)`: per-call `false` opts out; a per-call object replaces the (possibly async) class declaration; a spec lacking both `user` and `id` → null (stateless). The explicit `forUser`/`continue` flow bypasses this resolver entirely.
- `preparePersistence`: explicit id → owner check then `load`; else most-recent thread for the (user, agent-class) pair from `store.list(user)` filtered by `agent` meta, or `create` a new one; snapshots the FULL persisted history (pre-`historyLimit`) as the trusted baseline for validation, then windows by `historyLimit` and merges caller `options.history`.
- `runWithPersistence` / `runWithPersistenceStreaming`: store lookup (throws "No ConversationStore registered" if unbound) → prepare → validate → run inner loop with merged history → `store.append(newMessagesFromTurn(input, response))` → stamp `conversationId` on the result. The streaming variant stitches this around `{ stream, response }` and rejects the response promise on any stage's failure.
- `newMessagesFromTurn`: `[user(input), ...(step.message + stringified tool results)*]` — mirrors the legacy `ConversableAgent.prompt` shape exactly so stores see no change.
- `ConversationOwnershipError`: distinct type so servers answer 403 not 500; carries `conversationId` + the scoped `userId`, never the real owner's id; a bare `continue()` gets a hint to chain `forUser(ownerId)`.

## Problems

- Ownership (#984) must be inferred from `store.list()` entries because the `ConversationStore` contract has no `getOwner`: `storedOwner` tries a scoped listing first (indexed read; a hit settles it), then the unscoped listing; threads with no reported owner stay permissive (pre-#984 rows and stores that don't mirror `meta.userId` must keep working) — EXCEPT when the store demonstrably holds rows its unscoped `list()` hides (`hidden`), where absence is no evidence and the resume is refused rather than failing open.

## Facts

- The validate hook's "incoming" view is `options.messages` (full continuation) when set, else `options.history`; approved/rejected tool-call ids are forwarded to it.
- Stores that don't persist `agent` in list results simply always create new threads — the conservative fallback.
- `updatedAt ?? createdAt` orders thread recency.
