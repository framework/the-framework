Carries the composer draft across a device hop (#1066) or an in-app navigation (#1139) via a sessionStorage stash, keeping the typed prompt out of the address bar, history, and Referer headers.

## TLDR

- `stashDraftFromUrl()` — at SPA boot: moves `?draft=` into sessionStorage under `fw.pending-draft` and strips only that param from the URL via `history.replaceState`. Idempotent; no-op without the param.
- `stashPendingDraft(draft)` — the same stash written directly for an in-app navigation (#1139): a click that knows what the next session should be about but lands on the launcher (e.g. a hot ticket with no run of its own).
- `takePendingDraft()` — returns and clears the stash, so a reload does not re-seed the composer.

## Decisions

- The in-app carry deliberately does NOT use a `?draft=` param like the device hop: that navigation never leaves the tab, so there is nothing to hand another device and no reason to put the prompt in the URL.
- sessionStorage access goes through a try/catch helper returning `undefined` during prerender (ssr:false, no browser).

## Facts

- Cross-file contract: `profiles.ts#connectTo()` appends `?draft=` alongside `?token=`; the #1051 bootstrap 302 strips only `token`, so the draft survives to land on the remote SPA as `/?draft=…` for this module to stash.
