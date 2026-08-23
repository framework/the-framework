What the tests cover: a view that draws fine is left completely untouched; a view that fails to draw is replaced by an error card carrying the failure's own message, with the failing view gone rather than still trying to draw; every such failure leaves a trace in the browser console; and "Try again" re-draws the view, recovering fully once the cause has passed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
