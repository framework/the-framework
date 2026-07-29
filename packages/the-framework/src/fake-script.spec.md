The deterministic `--fake` demo scenario: a scripted `FakeDriver` whose turns walk the exact prompt order of the scope→deploy flow (one build turn — nothing reviews it, #1372) for a small Vike + Prisma orders app — fully offline, no CLI, no model, driven entirely through the driver seam.

## TLDR

- Exports `FAKE_INTENT` (paginated orders page with sign-in), `FAKE_SIGNALS` (vike-react/react/@prisma/client deps so the Vike preset wins detection), `FAKE_DEPLOY` (ssr on cloudflare), and `fakeDriver()` (sessionId `fake-orders-app`).
- Each turn carries a small plausible usage so the demo shows spend accumulating (#322).
- `FRAMEWORK_FAKE_AWAIT=choices|multiselect|confirmation` swaps the build turn for one ending in an ```await-choices```/```await-multiselect```/```await-confirmation``` block, followed by a `RESUME_TURN` — so the turn-boundary gates (#337 single-select, #339 multi-select, #358 confirmation) can be seen offline. Needs the dashboard on, so `requestChoice` is wired.
- The build turn is the whole loop (#1372: no preset, no serve config → no review); deploy still narrates at the end.
