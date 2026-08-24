# Bug analysis: packages/framework/dashboard/components/DiscordDialogs.test.tsx

## Business logic (high-level)

Pins exactly what `DiscordDialogs.test.SPEC.md` claims: (1) saving hands the daemon the webhook
under its own key (leaving other credentials untouched — asserted via the exact one-key patch
object), (2) a non-URL is called out and Save stays disabled before any daemon contact, (3) the
dialog's toggle flips Discord delivery (`notifyDiscord`) specifically. The file-header comment
also *mentions* the env-set and Replace/Remove contracts, which are not tested here — the test
SPEC does not claim them, so that is a stated-scope gap, not a lying test.

Harness: `saveDiscordCredentials` hoisted and explicitly typed as the RPC's result union (so the
refusal case is settable — though no test uses it yet); preferences module mocked with mutable
`prefs` + `discordEnabled` mirroring the real default; dialog rendered `open` with a `channels()`
fixture builder (`sources` + `editable`, `discordWebhook` derived). Mocks reset per test;
`afterEach(cleanup)`.

Untested (gaps): env-set rendering, saved-state Replace/Remove (including `save(null)`), the
non-storable branch, save failure surfacing, close-clears-value effect, the replacing-cancel
path — and therefore the minor replacing-shows-"Not configured yet" bug found in the source went
unnoticed.

## Functions (low-level)

- `channels(sources, editable)` (L28): well-shaped fixture; defaults to nothing configured +
  storable. Correct.
- "saving a webhook URL sends it under its own key" (L48): types a valid URL, clicks Save, awaits
  the RPC call with the exact `{ webhook: … }` patch — `toHaveBeenCalledWith` on the whole object
  pins that no sibling keys ride along. Properly awaited. Correct.
- "a URL that is not one is refused before the round trip" (L59): asserts the validation message
  and the disabled Save synchronously; does not assert `saveDiscordCredentials` was never called —
  implied by the disabled button but a click-and-assert-not-called would be stronger. Still
  falsifiable as written. Correct.
- "its toggle is Discord delivery, not the bot" (L67): clicks Enable, asserts
  `updatePreferences({ notifyDiscord: true })`. Correct.

## Bugs found

None found.
