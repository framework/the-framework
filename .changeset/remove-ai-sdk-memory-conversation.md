---
'@gemstack/ai-sdk': minor
---

Removed the built-in memory (`Agent.remembers()`, `withMemoryInject`, `withMemoryExtract`, `MemoryUserMemory`, `UserMemory`) and conversation-persistence (`Agent.conversational()`, `forUser()`/`continue()`, `ConversableAgent`, `ConversationStore`, `MemoryConversationStore`, `sanitizeConversation`) features. Neither had a caller anywhere in this monorepo — every consuming agent (in `ai-autopilot` and, historically, this package's own tests) called `.prompt()`/`.stream()` stateless, with both opt-in hooks left at their `false` default.

`AgentResponse`/`HasMemory` lose their `conversationId` field, and the corresponding `AiEvent` shapes drop it too. `Agent.prompt()`/`.stream()` now call the loop directly with no persistence branch. `BudgetStorage` (unaffected, unrelated feature) remains the one neutral persistence contract this package ships.

Breaking for any downstream consumer of the removed exports; none exist inside this repo.
