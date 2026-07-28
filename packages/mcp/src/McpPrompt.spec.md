Abstract base class for MCP prompts: derived name, optional Zod arguments schema, `handle()` returning messages, and optional `shouldRegister()` visibility gating.

## Facts

- `name()` defaults to kebab-cased class name minus the `Prompt` suffix (`CodeReviewPrompt` → `code-review`); `description()` reads the `@Description` decorator (empty string if absent).
- `arguments?()` returns a `ZodLikeObject` (Zod v3 or v4); when absent, `prompts/get` args pass through unvalidated.
- `handle()` returns `McpPromptMessage[]` with `content` as a plain string — the runtime adapts to the wire's `{ type: 'text', text }` shape.
- `shouldRegister?()` returning `false` hides the prompt from `prompts/list` AND makes `prompts/get` throw "Unknown prompt" — direct-call bypass is prevented, not just listing.
- Extra `handle()` params beyond `args` are DI-resolved when the method carries `@Handle()`.
