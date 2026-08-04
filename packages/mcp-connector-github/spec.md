`@gemstack/mcp-connector-github` — the first-party GitHub connector: nine tools over the GitHub REST API (issues, pull requests, repo file reads), following the `@gemstack/mcp-connectors` contract.

## TLDR

- `src/index.ts` is the connector definition (`auth: { type: 'pat', env: 'GITHUB_TOKEN' }` — an OAuth bearer works identically); `src/client.ts` is a minimal fetch wrapper, deliberately SDK-free (no Octokit) to stay light.
- This package doubles as the template that third-party connector authors copy.

## Facts

- Responses are **slimmed** (`slimIssue`/`slimPull`, restricted fields) to keep agent token usage down — raw API envelopes never reach the agent.
- Every path segment is `encodeURIComponent`-escaped (`get-file` encodes per segment to preserve `/`) — the input-validation fix in `@gemstack/mcp` 0.4.0 was motivated by exactly this connector's path-injection risk.
- `list-issues` filters out PRs client-side, since GitHub's issues endpoint returns PRs too.
- Read tools are annotated `readOnly` (+`openWorld`) so an agent host can auto-approve reads; a missing token surfaces as a 401 error naming both remedies (env var or mount-time `credentials`); transport failures become `GitHubError(status: 0)` rather than a raw `TypeError`.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
