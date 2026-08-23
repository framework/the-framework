What the tests cover: launching the agent's browser and wiring its tools to it.

- Chrome is launched with its debug port open, on a throwaway profile rather than the user's own, headless by default and headful when asked.
- Finding Chrome: an explicitly configured path wins over the platform's usual install locations; a configured path that does not exist falls through to a browser that is actually installed rather than hiding it; failing both, the browser names on the executable search path are tried; a machine with no browser at all resolves to nothing, which is what makes the agent fall back to tools that launch their own browser.
- The debug endpoint is polled until it answers, and gives up rather than hanging the agent when it never does — so a browser nothing is behind is never handed to the agent.
- The browser tools are pointed at the browser The Framework launched when there is one, and otherwise keep launching their own; folding them into an agent's setup only happens when browser tools were asked for.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
