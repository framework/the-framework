# Bug analysis: packages/framework/dashboard/components/AddDeviceDialog.test.tsx

## Business logic (high-level)

Pins the three behaviors its SPEC names, against the real `profiles.ts` storage (no mocks —
assertions read `listProfiles()` back out of the actual localStorage, cleared in `afterEach`
along with `cleanup()`, so tests are isolated and the origin/token split is tested end to end):

1. Pasting `http://192.168.1.5:4200/?token=abc123` and clicking "Add device" stores exactly
   `{ id, label (host default), url (bare origin), token }` and fires both `onAdded` and
   `onClose` — this genuinely pins the origin normalization (query stripped), the host-default
   label, and the close-after-save contract.
2. A URL without a token leaves the button disabled and shows the "no token" explanation — pins
   the savability gate and the *which-reason* messaging.
3. A typed name overrides the host default — pins the optional-label path.

The queries are sound: `getByPlaceholderText(/host:port/)` uniquely matches the URL input (the
name field's placeholder becomes "Name (optional) — defaults to …" once a URL parses, never
containing "host:port"), and `getByPlaceholderText(/Name/)` uniquely matches the name field.
Every assertion can fail if the behavior regresses (disabled flag read off the real button,
storage read back, spy call counts). All interactions are synchronous `fireEvent`s — nothing
async to await.

Coverage gaps (noted, not bugs): no test for the "not a valid URL" branch of the warning, none
for Cmd/Ctrl-Enter save or Cancel, and — most relevantly — none for a scheme-less paste like
`localhost:4200/?token=abc`, which currently *crashes* the component render (see
AddDeviceDialog.BUG-ANALYSIS.md Bug 1); a regression test there would have caught it, and should
be added alongside the fix in `parseDeviceUrl`.

## Functions (low-level)

- **`afterEach`** — `cleanup()` plus `localStorage.clear()`; the second is required because
  profiles.ts caches a snapshot keyed to a notify counter — clearing storage without notify is
  fine here since each test re-renders fresh and `listProfiles()` reads storage directly.
  Correct.
- **test "pasting a ?token= URL saves a profile and closes"** — change → click → deep-equal on
  stored list → spies. The deep equality is strict (id/label/url/token all pinned), so a change
  to normalization or labeling fails it. Correct.
- **test "a URL without a token cannot be saved"** — disabled assertion via the concrete
  `HTMLButtonElement`, message presence via `getByText(/no token/i)`. Correct.
- **test "an optional label overrides the host default"** — stores then reads `label`. Uses
  `listProfiles()[0]!` — safe because the click preceded it; if saving broke, the assertion
  throws (test fails) rather than passing vacuously. Correct.

## Bugs found

None found. (The missing scheme-less-paste regression case is a coverage gap tied to the
component bug filed in AddDeviceDialog.BUG-ANALYSIS.md, not a defect in the existing tests.)
