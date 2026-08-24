# Bug analysis: packages/framework/dashboard/components/ContextFiles.tsx

## Business logic (high-level)

Presentational list of the file entries in the agent Context (#661): one row per path with an X
button (tooltip'd, aria-labelled) that reports the path to `onRemove`, disabled while `busy`;
renders nothing for an empty list. The caller owns the context set (files arrive from `#` mentions
and the file-tree; removal also unticks the tree — caller's job, per the header comment).

Edge cases: duplicate paths cannot occur (the context is a Set upstream), so `key={file}` is safe;
long paths truncate with a `title` fallback; empty-string path would render an odd but harmless
row (not producible — mentions and the tree only emit real paths). No state, no effects, no
lifecycle concerns.

## Functions (low-level)

### `ContextFiles({ files, onRemove, busy })`

Pure render. `onClick={() => onRemove(file)}` passes the exact path (test-pinned).
`disabled={busy}` blocks removal mid-start. Accessible name "Remove {file} from context" on the
real button; visual X inside the TooltipTrigger. Verdict: correct.

## Bugs found

None found.
