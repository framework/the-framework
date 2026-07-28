Abstract base class for MCP resources: a URI (optionally a `{param}` template), MIME type, string-returning `handle()`, and optional `shouldRegister()` visibility gating.

## Facts

- `uri()` is abstract; `isTemplate()` is simply `uri().includes('{')` — template resources are listed under `resources/templates/list` and matched via `matchUriTemplate` on read.
- `mimeType()` defaults to `text/plain`; `description()` reads the `@Description` decorator.
- `handle(params?)` receives extracted template params (`Record<string, string>`) for template resources, `undefined` for static ones; returns the content as a string.
- `shouldRegister?()` returning `false` hides the resource from both list endpoints AND makes `resources/read` throw "Unknown resource" — bypass via direct URI is prevented.
- Extra `handle()` params beyond `params` are DI-resolved when the method carries `@Handle()`.
