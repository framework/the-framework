# Bug analysis: packages/framework/dashboard/components/DiscordDialogs.tsx

## Business logic (high-level)

The Discord setup dialog (#958/#1095): `DiscordWebhookDialog` wires the generic `CredentialDialog`
shell for the webhook — explainer (also exported for the onboarding checklist), the
write-only credential contract (value goes to the daemon, never read back; configured state offers
Replace/Remove, never a pre-filled field), env-set-wins reporting, non-storable-daemon reporting,
client-side validation before the round trip, and the independent delivery toggle.

Checked against `DiscordDialogs.SPEC.md`:

- **Four situations** (`fromEnv` → env notice naming `credentialEnvVar`; `!storable` → cannot set
  up here; `configured && !replacing` → saved card with Replace/Remove; else → "Not configured
  yet" + steps): present with the right precedence — except the *replacing* sub-state, which
  falls into the "Not configured yet" block while a webhook IS stored; see Bugs.
- **Field appearance**: `showField = storable && !fromEnv && (!configured || replacing)` — exactly
  the SPEC's rule. Masked (`type="password"`), `autoComplete="off"`, `spellCheck={false}`.
- **Validation**: `invalid` computed live from `validateCredential` only for non-empty input;
  Save disabled for empty/invalid/saving. Matches.
- **Save**: `saveDiscordCredentials({ webhook: next })` — the literal key is deliberate (comment:
  a computed key widens and the patch must leave other credentials alone). Failure (refusal or
  unreachable daemon via `.catch`) → error shown, nothing else changes. Success → field cleared,
  replacing off, `onSaved()` re-read. Remove = `save(null)`. All per SPEC.
- **Close hygiene**: effect clears value/error/replacing whenever `open` flips false — "never
  hand the next person at the keyboard a token". Correct (state persists across close only until
  the effect runs, and the dialog is unmounted-hidden by `open` anyway).
- **Toggle**: label on/off, description switches to "Can be turned on now…" while unconfigured,
  one button flipping `notifyDiscord`. Independent of the credential. Correct.

Concurrency: `save` guards double-fire via the disabled buttons (`saving`); the async `.catch`
fallback keeps the promise chain from rejecting. Un-awaited `void save(...)` is safe (save never
throws). No unmounted-setState guard — the dialog stays mounted while open, and `save` is only
reachable while open; closing mid-save would setState on a still-mounted (hidden) component —
harmless in React 18.

## Functions (low-level)

### `DISCORD_WEBHOOK_DESCRIPTION` (L23)

Exported for the checklist row + dialog (shown twice by design). Correct.

### `DiscordWebhookDialog(props)` (L37–61)

Wires title/steps/placeholder and the delivery toggle over `discordEnabled(usePreferences())`.
Correct.

### `CredentialDialog(...)` (L78–237)

Analyzed above. One more edge: `channels === null` (first read in flight) → `configured` false,
`storable` false → renders the "does not store credentials" copy for a beat until the read lands.
A momentary wrong message on a slow read; the host opens the dialog from surfaces that have
already loaded channels, so in practice `channels` is set before the dialog opens.
Suspicious-but-unproven; not reported (host-provided invariant).

## Bugs found

1. `L159`/`L174`: while Replace is active on a stored webhook, the status block renders the
   "Not configured yet" heading and the setup steps — a false statement, since a webhook is
   stored and remains stored until the replacement saves. Scenario: webhook saved → open the
   dialog → click Replace → the dialog now claims "Not configured yet" above the entry field.
   Contradicts the SPEC's situation model ("shows exactly one of four situations", where stored
   is "Already stored on the daemon… with a Replace button that reveals the entry field" — the
   field is revealed *within* the stored situation, not by pretending nothing is configured).
   Severity: minor (misleading copy only; behavior — Cancel restores the saved card, Save
   replaces — is right). Confidence: medium (the steps being handy while making a new webhook is
   a conceivable reading, but the heading is factually wrong). Fix sketch: while
   `configured && replacing`, keep the saved-state framing (e.g. keep the "Webhook URL saved"
   card or a "Replacing the stored webhook" heading) instead of the not-configured branch —
   e.g. split the render condition into `configured ? (replacing ? replacingHeader : savedCard)
   : stepsBlock`.
