Builders for provider-native tools — `WebSearch`, `WebFetch`, `CodeExecution` — each `.toTool()` produces a `Tool` carrying a `providerHint`/`meta` that adapters may replace with a native block, plus a generic server-side fallback.

## TLDR

- `WebSearch`: hint `{type:'web-search', allowed_domains?, max_uses?}` → Anthropic emits `web_search_20250305`, Google emits a top-level `{google_search:{}}` tools entry, OpenAI chat-completions has no equivalent (Responses-API-only) → falls through to the DuckDuckGo-HTML `server` execute (query gets `site:` suffixes when domains set). Gemini ignores `domains`/`maxResults` (its block accepts neither).
- `WebFetch`: plain server tool — `fetch` with 10s `AbortSignal.timeout`, `htmlToText`, result truncated to `maxLength` (default 10000); errors returned as `{error, url}` values, never thrown.
- `CodeExecution`: provider-native only; the server execute returns an error object by design — no server-side eval for security.
- `htmlToText`: best-effort HTML → plain text; skips `<script>`/`<style>` including their content; collapses whitespace.

## Decisions

- `htmlToText` is a single linear indexOf/startsWith scan, NOT regex: `<[^>]+>` is polynomial ReDoS on `<<<<…` and end-tag regexes are always incomplete for some whitespace variant — both trip CodeQL. It is content extraction, not a security sanitizer (output is fed to the model as text, never rendered).
- Unterminated `<script`/`<style>`/tag drops the rest of the input rather than guessing.

## Facts

- Fallback requests send `User-Agent: gemstack-ai-sdk/1.0`.
- `meta.providerNative: true` + `meta.type` mark these tools for adapters; the hint cascade mirrors the Phase 2 file-search plumbing.
