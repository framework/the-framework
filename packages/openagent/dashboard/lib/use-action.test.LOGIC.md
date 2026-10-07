What the tests cover:

- **A successful action** - it hands its result back to the surface, reports no reason for failure, and stops being busy.
- **An action the daemon refuses** - the daemon's own reason is reported and the surface is told the action did not happen, so it skips its success side.
- **An action that fails outright** - the failure's own message is reported when it has one, and the surface's fallback wording when it does not.
- **An action that answers nothing** - it counts as a success and reports no reason for failure.
- **Dismissing the reason** - the reported reason can be cleared by the surface.
