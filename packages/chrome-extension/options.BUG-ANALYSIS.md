# Bug analysis: packages/chrome-extension/options.js

## Business logic (high-level)

The extension's settings page: loads/stores the three settings (`daemonUrl` — default
`http://localhost:4200`, trailing slashes stripped; `token`; `autoOpen` — checkbox default
checked, written out explicitly on save), and proves the connection immediately after every save
by walking the diagnosis ladder from `options.SPEC.md`:

1. host grants actually held (`chrome.permissions.contains` for the daemon origin and claude.ai) —
   checked first because a missing grant is otherwise indistinguishable from a wrong token;
2. 401 → token rejected; 3. 404 → bridge switched off; 4. 426 → daemon's version-skew refusal
   relayed verbatim; 5. other non-ok → status shown; 6. 200 with a body other than `ok` → a
   dashboard build with no bridge route (the SPA answers 200 HTML for unknown paths);
7. fetch throw → dashboard unreachable. Only a clean `ok` counts as connected, and success goes
   on to list `/_bridge/sessions` and say whether tabs will open (honoring the checkbox state
   just saved).

A second button asks the worker (`tf-open-now`) to run the tab sweep immediately and renders the
worker's structured result: did-nothing reason, nothing-to-open with skip reasons, or
opened-X-of-Y. A worker that never answers (`lastError` / no reply) is named with the reload fix.

Ordering concern: settings are saved *before* the test, so even a failing test leaves the values
stored — intended ("Saved. Testing…"). The save handler is not guarded against double clicks, but
a second run is idempotent (re-save, re-test). The version header is built per save from the
manifest. All failure text lands in `#status` via `textContent` — no injection surface.

One cross-document inconsistency worth recording: `packages/chrome-extension/SPEC.md` calls tab
opening "(opt-in)" ("Opening tabs is opt-in from the options page"), and background.js L350
comments "Opt-in: opening tabs on someone's behalf should be asked for, not assumed" — but this
file (checkbox defaults checked, `autoOpen !== false`), `options.SPEC.md` ("on unless the user
turns it off"), and background.js's actual guard (`autoOpen === false`) all implement default-on,
i.e. opt-out. Until the user first opens this page nothing has "asked", yet the worker opens tabs.
Two intent sources against two; the behavior is coherent and useful either way, but the documents
contradict each other (Bug 1).

## Functions (low-level)

- **Initial load (L10-15)** — `chrome.storage.local.get(...).then(...)`: populates the inputs;
  `autoOpenEl.checked = autoOpen !== false` (unset ⇒ checked). Promise-form storage API is fine
  under MV3. Race with the user editing before load resolves is theoretical (load is ~ms).
  Correct.
- **`say(message, isError)` (L17-20)** — status line with error styling via class. Correct.
- **`missingHosts(daemonUrl)` (L31-39)** — checks `${daemonUrl}/*` and `https://claude.ai/*` via
  `chrome.permissions.contains`, treating an API error as "missing". Origin patterns with an
  explicit port (`http://localhost:4200/*`) are valid Chromium match patterns and are contained
  by the manifest's port-less `http://localhost/*` grant, so the default URL passes. A daemon URL
  on a non-declared host (e.g. `http://192.168.1.5:4200` for a remote dashboard) is correctly
  reported as ungranted — though the advice ("switch those on under Site access") cannot succeed
  there because the origin is not declared in the manifest at all; that is the documented
  localhost-only scope of the extension, so a doc-accurate dead end, not a bug. A URL pasted with
  a path (`http://host:4200/dash`) yields pattern `http://host:4200/dash/*`, still contained by a
  host-wide grant. Correct.
- **Save handler (L41-88)** — trims the token (refuses empty), normalizes the URL, stores all
  three keys explicitly, then runs the ladder exactly as the SPEC orders it. `res.text()` is read
  once per branch (426 branch reads it, `body !== 'ok'` branch reads it separately on a different
  path) — no double-read of one response. The sessions probe tolerates its own failure with
  "Could not list sessions." while still reporting connected — matches the SPEC's "one step
  further" framing. Uses `autoOpenEl.checked` (the just-saved value) for the tabs message.
  Correct.
- **Open-now handler (L93-102)** — sends `tf-open-now`; distinguishes lastError / no reply /
  `ok:false` (reason) / `opened===0` (reason and skip list) / success ("Opened X of Y"). The
  worker's `closed` count is not surfaced, and the stored `lastOpen` record is never displayed —
  the button always triggers a fresh sweep instead, which satisfies the SPEC's user story;
  noted, not a bug. Correct.

## Bugs found

1. `L14` (with `packages/chrome-extension/SPEC.md` and background.js L350-351): **The specs
   contradict each other — and the code comment contradicts the code — on whether tab opening is
   opt-in.** The directory SPEC says "the extension keeps one pinned, inactive tab per session
   (opt-in)" / "Opening tabs is opt-in from the options page", and background.js's guard is
   commented "Opt-in: opening tabs … should be asked for, not assumed"; but the implemented
   behavior everywhere (this file's `autoOpen !== false` default-checked checkbox,
   `options.SPEC.md`'s "on unless the user turns it off", background.js's `autoOpen === false`
   early-return) is default-on before the user has ever been asked. Scenario: a user installs the
   extension, configures nothing, has a token-less setup — no tabs (token gate) — but the moment
   a token is saved with the checkbox untouched, tabs open although per the directory SPEC they
   only should after an explicit opt-in. Whichever way it is resolved, one intent source is
   wrong. Severity: minor. Fix: pick the implemented semantics (default-on, switchable off) and
   reword `packages/chrome-extension/SPEC.md`'s two "opt-in" phrases and the background.js L350
   comment to match — or, if opt-in is truly intended, flip the defaults here (unchecked) and in
   background.js (`autoOpen !== true` gate).
