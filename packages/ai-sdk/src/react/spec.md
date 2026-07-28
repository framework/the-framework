`@gemstack/ai-sdk/react` subpath: React client runtime for streamed agent runs.

## TLDR

- `agent-run.ts` — framework-free core: transcript reducer (`appendAgentOutput`), client-tool batch (`executeClientTools`), run/resume driver (`driveAgentRun`).
- `useAgentRun.ts` — the React hook: state machine + imperative run/respond/approve/reject/reset over the core.
- `agent-run.test.ts` — exhaustive core tests (no React harness exists or is wanted).
- `index.ts` — re-exports hook + core.

## Facts

- Layering rule: React appears only in `useAgentRun.ts`; the core has no `react`/`node:` imports and is exported for non-React consumers.
- Consumes the named-event agent-SSE protocol from `src/agent-sse.ts` (`readAgentStream`); the server-side framers live there too.
- `react >= 19.2.0` is an optional peer dependency of the package — only this subpath needs it.
