The shared pause-and-ask machinery: an agent can park a run mid-conversation to ask the human something — pick one option, tick several, approve or decline a plan, handle a browser page it is stuck on, or bind the run to a project — and the run continues with the answer.

## TLDR

- Each gate shows its options, waits for the pick, and re-prompts the agent with the answer, repeating until the agent stops asking — capped so it cannot ask forever, and a declined plan ends the exchange rather than building on it.
- With nobody to answer (headless, or stopped mid-question) a gate falls back to its recommended option so it never hangs; the browser gate recommends "not handled", because claiming a human cleared a login wall nobody saw sends the agent back to a blocked page.
- Once the agent stops asking, live chat takes over: each user message resumes the same conversation; by default the run finishes what queued and ends itself — only a run whose own terminal is the single surface stays parked for the next message.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
