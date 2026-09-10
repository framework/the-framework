The net under the whole dashboard: when drawing a view fails, the user sees a recoverable card on the themed shell instead of a blank white page — the browser would otherwise unmount everything, so one bad line off the live event stream or one panel reading a field the daemon has not written yet would take the entire app with it. A crash costs the user a view and a click, never the agent [1]: the daemon keeps running throughout.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **The card instead of the blank page** - a view that fails to draw is replaced by a centered card reading "Something went wrong" with an explanation, the error's message, and the buttons "Try again" and "Reload".
- **Two ways out** - "Try again" redraws the failed view, which recovers when the cause was transient and lands back on the card when it was not; "Reload" reloads the page, the sure way out.
- **A trace for whoever debugs it** - the error and where in the view it happened are written to the browser console, the one record of a crash the daemon never sees.

## Business logic

### The card instead of the blank page

#### Context

**Problem**: a crash while drawing looks random because it is data driven — a particular event, a particular poll, a particular moment — and with nothing on screen there is nothing to click and nothing to read.

#### Business logic

While nothing fails, the wrapped view renders untouched. When drawing it throws, the failed view is removed and the space shows an alert card, centered on the themed background: the heading "Something went wrong", the explanation "The dashboard hit an error and could not finish drawing this view. Your session is safe — the daemon keeps running. Try again, or reload the page.", the error's own message in a monospaced box when it has one, and two buttons.

### Two ways out

#### Context

See "The card instead of the blank page".

#### Business logic

"Try again" clears the error and draws the view afresh: a transient cause, such as a hiccup on the live stream or a half-written read that the next poll completes, then renders through; a durable cause throws straight back to the card, no worse than before. "Reload" reloads the whole page and sits beside it as the sure way out.

### A trace for whoever debugs it

#### Context

**Problem**: the daemon never sees the browser console, and a blank page carries no trace on its own.

#### Business logic

Every caught error is written to the browser console as "Dashboard render error:" with the error and the trail of the view it happened in, so the crash is diagnosable rather than opaque.
