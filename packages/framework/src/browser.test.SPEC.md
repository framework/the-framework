What the tests cover: launching the agent's browser and wiring its tools to it.

- Chrome is launched with its debug port open, on a throwaway profile rather than the user's own, headless by default and headful when asked.
- Finding Chrome: an explicitly configured path wins over the platform's usual install locations; a configured path that does not exist falls through to a browser that is actually installed rather than hiding it; failing both, the browser names on the executable search path are tried; a machine with no browser at all resolves to nothing, which is what makes the agent fall back to tools that launch their own browser.
- The debug endpoint is polled until it answers, and gives up rather than hanging the agent when it never does — so a browser nothing is behind is never handed to the agent.
- The browser tools are pointed at the browser The Framework launched when there is one, and otherwise keep launching their own; folding them into an agent's setup only happens when browser tools were asked for.
- The browser dies with its agent: an agent process exiting without having closed its browser kills the browser; a browser closed the ordinary way disarms that, leaving nothing behind; and a launched browser is armed this way from the start, against a stand-in Chrome that answers on its debug port.
- Leftover browsers: from a process listing, an agent browser whose parent is the init process, a process that is not Node, or a process no longer listed is an orphan, while one under a live Node agent is not — including a Node whose install path contains spaces, since the listing prints commands unquoted; a browser's helper processes, the daemon's bridge browser and unrelated processes are never picked. The sweep kills each orphan and removes its profile, still removes the profile of one that exited first, and does nothing on Windows. Against the real process listing: a browser process the init process inherited is killed, and one this process holds is spared.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
