Ollama provider (`name: 'ollama'`) — `defineOpenAiCompatible` against a local Ollama server, default base URL `http://localhost:11434/v1`.

## Facts

- `defaultApiKey: 'ollama'` — Ollama ignores the key, but the OpenAI SDK refuses to construct without one.
- The only provider whose config is entirely optional (`constructor(config = {})`), since neither key nor URL is required locally.
