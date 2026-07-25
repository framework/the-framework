---
'@gemstack/the-framework': patch
---

The dashboard no longer goes to a blank white screen when a view hits a render error. It had no error boundary, so any uncaught error while drawing a view — a stray line off the live feed, a panel reading a field the daemon had not written yet — unmounted the whole React tree to the root and left nothing on screen and nothing to click. It read as random because it was data-driven: a particular event, a particular poll, a particular moment. A caught render error now shows a recoverable card on the themed shell — Try again, or Reload — and logs the stack to the console so the next occurrence leaves a trace, rather than taking the session with it.
