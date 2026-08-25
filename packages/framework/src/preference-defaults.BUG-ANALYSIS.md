# Bug analysis: packages/framework/src/preference-defaults.ts

## Business logic (high-level)

A leaf constants-and-predicates module: what an unset preference means, and the bounds shared by
the controls that write preferences. Its reason to exist is *single sourcing across the process
boundary* - the control that writes a value runs in the browser, the sanitizer that clamps it and
the code that acts on it run in the daemon, so the number and the polarity must be one import.
It deliberately contains no `node:*` so `client.ts` (the dashboard's entry into `src/`) can
re-export it; the `Preferences` import from `registry.ts` is `import type`, so it erases and there
is no runtime cycle even though `registry.ts` re-exports these same constants.

Two pieces of business logic:

**1. The notification 2x2.** Four stored keys are two axes: *method* (`notifyBrowser`,
`notifyDiscord`) and *category* (`notifyHumanIntervention`, `notifyNewActivity`). A cell delivers
only when both are on. The polarities are intentionally non-uniform - browser and "needs you"
default on, Discord and plain activity default off - which is precisely why the module exists: the
composition used to be open-coded at each call site and one site copied its sibling's polarity and
got it backwards. Verified against `registry.ts`'s own JSDoc for all four keys: `notifyBrowser`
"Absent = on", `notifyHumanIntervention` "**Absent = on**", `notifyDiscord` "Absent = off",
`notifyNewActivity` documented as "the default-off counterpart". All four match
`NOTIFICATION_DEFAULTS`. The SPEC's TL;DR ("defaults follow reach") matches too.

**2. Shared bounds.** `MAX_SPEND_OFFSET = 50` is the clamp applied in three places
(`registry.ts#sanitizePreferences`, the `Quota` slider's `onChange`, the Settings number field's
`min`/`max`), all importing this constant, so a hand-edited config cannot exceed what the slider
can produce. `DEFAULT_SPEND_OFFSET = 100/(7*2)` is the unset slider position (half a day of the
week's allowance). `DEFAULT_AUTO_PM_CONCURRENCY = 2` is the unset Auto PM concurrency.

Failure modes considered: none of this is stateful, asynchronous, or ordered. The only way it can
be wrong is a value disagreeing with what the rest of the system assumes, which is what the
cross-checks above rule out.

## Functions (low-level)

### `NotifyMethod` / `NotifyCategory` (types), `METHOD_KEYS` / `CATEGORY_KEYS` (private consts)

`satisfies Record<NotifyMethod, keyof Preferences>` makes the compiler enforce both that every axis
value has a key and that each key exists on `Preferences` - a renamed preference key fails to
compile here rather than silently reading `undefined` and applying the default forever, which would
be the silent-wrong-default failure this module was built to prevent. `as const` keeps the value
types literal so the indexed reads below stay precisely typed. Verdict: correct.

### `NOTIFICATION_DEFAULTS` (exported const)

`{ methods: { browser: true, discord: false }, categories: { humanIntervention: true, newActivity:
false } }`, `as const satisfies` the full record shape, so an added axis value fails to compile
until its default is written down. Exported (and re-exported through `client.ts`) so the dashboard
draws toggles in the same positions the daemon acts on. Verdict: correct.

### `notifyMethodEnabled(preferences, method)`

`preferences[METHOD_KEYS[method]] ?? NOTIFICATION_DEFAULTS.methods[method]`. `??` (not `||`) is
required here and is what makes an explicitly stored `false` win over a `true` default; `||` would
have made "browser notifications off" unrepresentable. `null` from a hand-edited JSON also falls
through to the default, which is the desired reading of "nobody has said". Verdict: correct.

### `notifyCategoryEnabled(preferences, category)`

Same shape over the category axis; the same `??` reasoning applies, and here it is even more
load-bearing because `notifyHumanIntervention` defaults *on*. Verdict: correct.

### `notifies(preferences, method, category)`

`notifyMethodEnabled && notifyCategoryEnabled` - the one place the 2x2 is composed. Short-circuits,
which is irrelevant since both operands are pure. Used by `daemon-services.ts` for both Discord
cells and by `dashboard/lib/preferences.ts` for the browser ones. Verdict: correct.

### `MAX_SPEND_OFFSET`, `DEFAULT_SPEND_OFFSET`, `DEFAULT_AUTO_PM_CONCURRENCY`

Plain numbers. Consumer check: `registry.ts` clamps *and* `Math.round`s the stored offset to an
integer while `DEFAULT_SPEND_OFFSET` is fractional (7.142857...). That is deliberate and documented
at both ends (SettingsPage: "A saved value is an integer, so the rounding only ever trims the
default"), and the Settings field renders the default to one decimal rather than showing a 0 the
daemon is not using - so the fractional default and the integer sanitizer do not disagree.
`DEFAULT_AUTO_PM_CONCURRENCY` is floored at 1 by both `auto-pm.ts` call sites (`Math.max(1,
Math.floor(...))`), matching the SPEC's "floored at one, no upper bound". Verdict: correct.

## Bugs found

None found.
