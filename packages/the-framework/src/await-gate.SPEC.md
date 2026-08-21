The shared pause-and-ask machinery: an agent can park mid-conversation to ask the human a question, and carries on with the answer.

## Flows

- One resolution path: a gate (one parked question) shows its options, waits for the pick, and re-prompts the agent with the answer, repeating until the agent stops asking — capped so it cannot ask forever. A gate that takes several picks answers with the labels it got; every other gate answers with the one label picked.
- Almost every answer goes back to the agent. The exception is an answer the agent marked as ending it — declining a plan being the one that matters: the user's next move is fresh instructions, and building on a plan they just rejected is the worst use of the time until those arrive. On a gate taking several picks, one stopping pick among several still stops.
- With nobody to answer (headless, or stopped mid-question) a gate falls back to its recommended option so it never hangs. Which option that is belongs to the agent: handing over a browser recommends "could not handle it", because claiming a human cleared a login wall nobody saw sends the agent back to a blocked page.
- Once the agent stops asking, live chat takes over: each user message resumes the same conversation; by default the agent finishes what queued and ends itself — only one whose own terminal is the single surface stays parked for the next message.

## Rationales

- Whether an answer ends the agent is a property of the question, so the agent says which answers mean it; a dedicated plan-approval gate kind would make one question a special case instead of one among many.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
