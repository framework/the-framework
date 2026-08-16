The shared pause-and-ask machinery: an agent can park a run mid-conversation to ask the human a question, and the run continues with the answer.

## TLDR

- One resolution path, not four. A gate shows its options, waits for the pick, and re-prompts the agent with the answer, repeating until the agent stops asking — capped so it cannot ask forever. A gate that takes several picks answers with the labels it got; every other gate answers with the one label picked.
- Every answer goes back to the agent, a decline included. Declining a plan used to abort the run — the last self-stop in the codebase — and went with the gate kind that raised it: what the user picked is information the agent acts on, not a process the framework kills out from under it.
- With nobody to answer (headless, or stopped mid-question) a gate falls back to its recommended option so it never hangs. Which option that is belongs to the agent: handing over a browser recommends "could not handle it", because claiming a human cleared a login wall nobody saw sends the agent back to a blocked page.
- Once the agent stops asking, live chat takes over: each user message resumes the same conversation; by default the run finishes what queued and ends itself — only a run whose own terminal is the single surface stays parked for the next message.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
