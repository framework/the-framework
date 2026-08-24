# Bug analysis: packages/framework/dashboard/components/TicketPlanPage.tsx

## Business logic (high-level)

One ticket's plan (#685): renders `tickets/<stem>.plan.md`, addressed from the ticket's slug, read
through the confined `onFileContent` (server-side `safeRepoPath` guard + length cap — verified in
`src/dashboard-rpc/reads.ts:345`), polled every 10s so a plan being written grows on screen.

Against `TicketPlanPage.SPEC.md`:

- **Addressing** — `planPath` strips the `.md` extension and appends `.plan.md` under the browser-
  local `TICKETS_DIR` literal; header shows the path; Back button present. Matches spec. A
  hand-typed traversal slug (`../../x`) composes into a path the server read rejects (null → "no
  plan yet") — safe.
- **Read like any file** — same RPC as the preview cards; 10s poll via `usePolled` with
  `[projectId, path]` deps (identity change resets value + `loaded`, interval cleaned up on
  unmount). Matches spec.
- **States** — `!loaded` → "Loading…"; `!plan || plan.binary` → "This ticket has no plan yet."
  (a binary `.plan.md` cannot meaningfully render, and treating it as absent is the sane
  degenerate); else Markdown + truncation note when `truncated`. Matches spec, including the
  capped-read admission.

Failure modes: a rejected poll keeps the previous value (useAsyncValue) — a daemon hiccup does not
blank a rendered plan; `loaded` stays false only until the first success, so a permanently dead
daemon leaves "Loading…", covered by the app-level health banner (reliance noted). No local state,
so no staleness across slug changes (unlike the detail page, everything here derives from the poll).

## Functions (low-level)

- **`planPath(slug)`** — `tickets/` + stem + `.plan.md`. Anchored `\.md$` replace: a slug without
  `.md` (not produced — tickets are `.md` files by construction) would still yield a sane
  `<slug>.plan.md`. A slug that is itself `x.plan.md` would map to `x.plan.plan.md` — but plan
  files are not listed as tickets, so unreachable (reliance noted). Correct.
- **`TicketPlanPage(props)`** — wiring as above; `path` recomputed per render, stable string in the
  dep list so the poll does not thrash. Correct.

## Bugs found

None found.
