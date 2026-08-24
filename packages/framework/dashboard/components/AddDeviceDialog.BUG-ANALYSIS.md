# Bug analysis: packages/framework/dashboard/components/AddDeviceDialog.tsx

## Business logic (high-level)

The "Add a device" modal (#1052): one paste of the `http://host:port/?token=…` URL another
machine's daemon printed on its network bind, an optional name, Save/Cancel. Responsibilities per
`AddDeviceDialog.SPEC.md`:

- **One paste, not a form** — `parseDeviceUrl` (lib/profiles.ts) splits the paste into origin and
  token; the user never transcribes a token.
- **A tokenless URL cannot be saved** — `valid = parsed !== null && parsed.token !== ''` disables
  "Add device"; once the user typed something, the reason is spelled out (not a URL vs URL with
  no token). The `save()` function double-guards (`if (!parsed || !valid) return`), so Ctrl-Enter
  cannot bypass the disabled state.
- **The name is optional** — placeholder shows the host that will be used; `addProfile` itself
  trims the label and falls back to the host, so the dialog passing the untrimmed `label` is fine
  (the `label.trim() ? { label } : {}` spread only decides presence; profiles.ts normalizes).
- **Per-browser storage** — `addProfile` writes localStorage; nothing daemon-side. Saving calls
  `onAdded()` then `onClose()`; Cancel and the dialog's own dismiss (`onOpenChange(false)`) close
  without saving. Cmd/Ctrl-Enter saves from either field via a keydown handler on the wrapper.

The failure mode that breaks this: `parseDeviceUrl` accepts any string the `URL` constructor
accepts, and the URL constructor accepts scheme-less pastes like `localhost:4200/?token=abc`
by treating `localhost` as the *scheme* — yielding an opaque URL whose `origin` is the literal
string `"null"` while `searchParams` still finds the token. Two consequences chain off that
(confirmed with node): the dialog's placeholder computes `new URL(parsed.url).host` =
`new URL("null")`, which **throws during render**, and `valid` is `true`, so were it not for the
crash a device with url `"null"` would be saved (its `connectTo` would navigate to the relative
path `/null`). Dropping the scheme is one of the most likely paste mistakes for this exact input
(`192.168.1.5:4200/…` happens to throw in `URL` and is handled; `localhost:4200/…` and any
hostname-first paste are not). See Bug 1.

## Functions (low-level)

- **`AddDeviceDialog({ onClose, onAdded })`** — state: `url`, `label`; derived: `parsed`,
  `valid`. Renders help line, URL input (autofocus, monospace), name input with dynamic
  placeholder, conditional warning (only when the user typed something and it is not savable —
  distinguishing the two reasons per SPEC), Cancel and the gated Add button. Edge cases: empty
  input → no warning, disabled button (correct); URL with empty `?token=` → "no token" branch
  (correct, `token: ''`); whitespace-only URL → `url.trim() !== ''` false → no warning while the
  button stays disabled (correct); the dynamic placeholder re-derives `new URL(parsed.url)` every
  render — the crash vector when `parsed.url` is `"null"` (Bug 1). Verdict: **bug found** (root
  cause in `parseDeviceUrl`, crash manifests here).
- **`save()`** — guards, `addProfile({url, token, ...label})`, `onAdded()`, `onClose()`. Ordering
  is right (list refresh callback before close). Correct.
- **`onKeyDown(e)`** — Cmd/Ctrl+Enter → preventDefault + save; plain Enter does nothing (matches
  the SPEC's "Ctrl-Enter … saves from anywhere in the dialog"; no accidental submit). Correct.

## Bugs found

1. `L50` (root cause: `parseDeviceUrl`, packages/framework/dashboard/lib/profiles.ts L89-96):
   **A scheme-less paste like `localhost:4200/?token=abc` crashes the dialog render — and would
   otherwise save a device with URL `"null"`.** `new URL('localhost:4200/?token=abc')` parses
   with `localhost` as the scheme, so `u.origin` is the string `"null"` while
   `searchParams.get('token')` still returns `abc`; `parseDeviceUrl` therefore returns
   `{ url: 'null', token: 'abc' }` instead of `null`. The dialog's name-field placeholder then
   evaluates `new URL('null').host`, which throws `Invalid URL` in the middle of render, taking
   down the React tree to the nearest boundary — triggered by exactly the paste mistake this
   dialog exists to absorb (dropping the `http://` prefix; verified in node, and note the
   near-identical paste `192.168.1.5:4200/?token=…` happens to be rejected cleanly, making the
   behavior arbitrary). Even without the placeholder crash, `valid` would be `true` and "Add
   device" would store an unusable profile whose `connectTo` navigates to the relative path
   `/null`, contradicting the SPEC's promise that only "a valid URL that carries a token" is
   savable. Severity: major. Fix (in `parseDeviceUrl`): reject opaque/non-http origins — e.g.
   `if (u.origin === 'null' || (u.protocol !== 'http:' && u.protocol !== 'https:')) return null`
   — so the paste falls into the existing "That is not a valid URL." branch; optionally also
   guard the placeholder with `hostLabel`-style try/catch as defense.
