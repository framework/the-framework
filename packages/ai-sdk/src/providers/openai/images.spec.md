OpenAI image-generation adapter (DALL-E / gpt-image) via SDK `images.generate`.

## Facts

- Named sizes `square`/`landscape`/`portrait` map to `1024x1024`/`1792x1024`/`1024x1792`; arbitrary size strings pass through.
- Requests `response_format: 'b64_json'`; result maps `b64_json` → `base64`, `url`, and `revised_prompt` → `revisedPrompt` when present.
