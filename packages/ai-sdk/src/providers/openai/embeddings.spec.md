OpenAI embeddings adapter over raw `fetch` (`POST {baseUrl}/embeddings`, default `https://api.openai.com/v1`) — no SDK client involved.

## Facts

- Forwards `OpenAI-Organization` and `defaultHeaders` manually since it bypasses the SDK (which is why it's absent from `client-construction.test.ts`).
- Usage mapped from `prompt_tokens`/`total_tokens`.
