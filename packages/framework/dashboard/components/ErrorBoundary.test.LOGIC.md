What the tests cover, for the net that catches a view failing to draw:

- **Untouched while healthy** - a view that draws without error renders as it is, with no alert on screen.
- **A crash shows a recoverable card** - when the view throws, an alert reading "Something went wrong" appears with the thrown message shown, and the failed view is gone rather than still trying to render.
- **A trace in the console** - the error is written to the browser console as "Dashboard render error:".
- **"Try again" recovers** - once the cause of the crash is gone, "Try again" redraws the healthy view and the alert disappears.
