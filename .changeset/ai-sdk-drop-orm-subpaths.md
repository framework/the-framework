---
"@gemstack/ai-sdk": minor
---

Decouple from `@rudderjs/orm` (epic: framework-agnostic engine).

The ORM-backed store subpaths `@gemstack/ai-sdk/conversation-orm`, `/memory-orm`, `/budget-orm`, and `/memory-embedding` are **removed** from this package. They imported `@rudderjs/orm`, coupling the agnostic engine to the Rudder ORM, so they have moved to the Rudder binding `@rudderjs/ai` under the same subpath names (`@rudderjs/ai/conversation-orm`, etc.). The `@rudderjs/orm` peer dependency is dropped.

**Breaking (0.x):** update imports from `@gemstack/ai-sdk/{conversation-orm,memory-orm,budget-orm,memory-embedding}` to `@rudderjs/ai/{...}`. The relocated implementations are unchanged and still implement the neutral `ConversationStore` / `UserMemory` / `BudgetStorage` contracts, which remain exported from `@gemstack/ai-sdk`. Non-Rudder apps implement those contracts against their own persistence, or use the in-memory defaults.
