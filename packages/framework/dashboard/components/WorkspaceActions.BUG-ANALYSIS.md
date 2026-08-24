# Bug analysis: packages/framework/dashboard/components/WorkspaceActions.tsx

## Business logic (high-level)

The checkout-actions row shared by the project home and the agent view (#809): GitHub link (#489),
open folder / open in editor (#490) addressing the project checkout or, with `agentId`, the agent's
worktree — plus the preferred-editor picker living inside the editor menu (#727).

Against `WorkspaceActions.SPEC.md`:

- **Same bar, either checkout** — every open call passes `agentId ?? undefined`; labels switch
  ("Open this agent's folder/checkout"). Matches spec and tests.
- **GitHub** — `onGithubUrl(projectId)` regardless of agent (a branch of the same repo — spec's
  rule); rendered only when non-null. `keepPrevious: true` deliberately holds the previous URL
  while a project switch loads (comment documents the icon-stability tradeoff); the brief window
  where the anchor still carries the old project's URL — or shows the icon for a project that turns
  out to have no GitHub — is that documented tradeoff, not reported.
- **Editor picker** — Default row (clears to `''`, described as `$FRAMEWORK_EDITOR, or code`),
  detected editors with label + bin, and a hand-set undetected editor appended as its own row so a
  stored choice always shows (spec's custom-row rule). Check mark on the stored bin, or on Default
  when unset. `closeOnClick={false}` keeps the menu open for correction — spec. All correct.
- **Failure shown, not carried over** — `error` from the shared `useAction` renders inline;
  `useEffect(reset, [projectId, agentId, reset])` clears it on any checkout switch (`reset` is a
  stable useCallback, so the effect fires exactly on switches). Matches spec.

Edge cases: `busy` disables both open buttons and the menu items (not the GitHub anchor — a plain
link, correctly). `editorRows` cannot duplicate keys (the custom row is appended only when its bin
is not among the detected). The stored editor `''` is falsy, so Default is ticked — consistent with
the Settings page's `''`-means-auto convention.

Staleness note (not a bug, recorded for accuracy): the file's own comments still describe a Serve
action ("and serve it (#475)" in the header comment, and the orphaned "Serve (#475) the checkout
this bar is about" comment at L135 sitting above the error span) — the Serve/preview feature has
been removed from the codebase (`rpc/control.ts` no longer exports `sendPreview`/`onServeTargets`/
`onPreviewStatus`/`sendStopPreview`), so these comments are drift, as are the matching stale mocks
in the test file. Comment-only; behavior is unaffected.

## Functions (low-level)

- **`WorkspaceActions({ projectId, agentId })`**
  - `githubUrl` — `useLoaded` keyed `[projectId]`, keepPrevious. Correct as designed.
  - `editorRows` — as above. Correct.
  - reset-on-switch effect — correct dependency set; also fires once on mount (harmless reset of a
    null error).
  - `open(target)` — routes through `useAction.run` with the `'Failed to open.'` fallback;
    `{ok:false,error}` results surface the daemon's message. Correct.
  - Render — GitHub anchor (`target="_blank" rel="noreferrer"`), folder button, editor dropdown
    (trigger `aria-label="Open in editor"`), picker rows, error span. The destructure alias
    `agentId: agentId` is a no-op curiosity. Correct.

## Bugs found

None found.
