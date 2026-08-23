The dashboard's safety net: when a view fails to draw, the user gets a recoverable error card instead of a blank white page.

## User story

The dashboard draws itself from live data — the agents' event streams and the daemon's polls. One malformed line, or one panel reading a value the daemon has not written yet, used to take the whole app down: nothing on screen, nothing to click, and no trace of why. It looked random because it was data-driven — a particular event, a particular poll, a particular moment.

## Business logic — TL;DR

- **A drawing failure costs a view, not the app** - the error is caught and shown as a card on the dashboard's own themed background, saying that the failure was in drawing this view, that the user's work is safe, and that the daemon keeps running.
- **Two ways out** - "Try again" re-draws the view, which is enough for a transient cause such as a stream hiccup or a half-written read the next poll completes; a durable cause throws straight back to this card, which is why "Reload" sits beside it as the sure way out.
- **The error's own message is shown** - so the user can say what happened, instead of reporting a blank screen.
- **Every crash leaves a trace** - the failure and where it happened are written to the browser's console, since the daemon never sees the browser and a blank page carries no record of its own.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
