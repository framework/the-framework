The "Enhanced System Prompt" disclosure on the launcher: the entire system prompt the agent will send, readable before it runs, so a user can see what The Framework wraps their prompt in rather than take our word for it.

## TLDR

- It renders through the same composition the agent itself uses — no second copy of the wrapping logic to drift — and states that nothing else is appended when it starts.
- Its two checkboxes are the two real axes, not new settings: the built-in anti-laziness block, and the framework integration as a whole; transparent mode is the master off-switch that empties the prompt entirely, and the rows always read the way the agent will actually behave.
- The summary's status dot lights only when both axes are fully on, with the state also spelled out for screen readers.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
