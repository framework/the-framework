A real `DeployTarget` that ships the built app to Cloudflare via the `wrangler` CLI, run inside the same runner session the build wrote into.

## TLDR

- `cloudflareTarget(options)` returns a `DeployTarget` (name default `'cloudflare'`) whose `deploy()` installs, builds, then runs `npx wrangler deploy` (Workers) or `npx wrangler pages deploy <dir> --project-name <name>` (Pages).
- `DeployExecutor` is the minimal seam — just `exec(command, opts)` — so a full `RunnerSession` satisfies it structurally; tests pass a fake.
- Product routing: SSR → Workers, SSG/SPA → Pages; `product: 'workers' | 'pages'` overrides `'auto'`.
- Reports the live URL by grabbing the *last* `*.workers.dev` / `*.pages.dev` URL in wrangler's stdout+stderr (`URL_RE`).

## Decisions

- Never throws: missing token, missing Pages `projectName`, failed install/build, or failed wrangler all return `{ deployed: false, detail }` so the final phase narrates instead of crashing an already-built app.
- Credentials are passed only through the wrangler command's `env` (`CLOUDFLARE_API_TOKEN`, optional `CLOUDFLARE_ACCOUNT_ID`) — install/build run without them — so behavior is identical for local and container sessions.
- Failure `detail` embeds the failing command plus `tail()`: last ~500 chars of stderr (or stdout).
- `installCommand`/`buildCommand` accept `false` to skip when the workspace is already installed/built.

## Facts

- Env fallbacks: `apiToken` ?? `CLOUDFLARE_API_TOKEN`, `accountId` ?? `CLOUDFLARE_ACCOUNT_ID` (read at deploy time, not construction).
- Defaults: install `npm install`, build `npm run build`, Pages `outputDir` `dist/client` (Vike's client build output).
- A Pages deploy without `projectName` short-circuits before running anything; a missing token short-circuits before install.
- A clean deploy with no URL in the output still reports `deployed: true` (detail notes "no URL found").

## Flows

- `deploy(ctx)`: resolve token/account → `productFor(ctx.plan.render, product)` → [pages] require `projectName` → install → build → `exec(wrangler…, {env})` → extract last URL → `{ deployed: true, url?, detail }`.
