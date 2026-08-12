Carries out one requested screen action against a live browser page and reports what happened.

## TLDR

- Each action maps onto the matching browser gesture — moving, clicking, dragging, typing, scrolling, waiting, screenshotting — holding any requested modifier keys around it.
- A failed action never crashes the agent run: the failure text goes back to the model, which decides whether to retry, recover, or give up.
- Key names arrive in Anthropic's naming and are translated to the browser's; unrecognized keys pass through untouched so new keys either work or fail visibly.
- Scroll requests count mouse-wheel clicks and are converted to pixels.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
