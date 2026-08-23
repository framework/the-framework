What the tests cover: chat messages already waiting are delivered to the agent in the order they were sent; a message that arrives while the agent is waiting is handed straight over; closing the chat wakes a waiting agent with "no message" and every later request also reports none; messages pushed after the chat is closed are ignored; stopping the agent — Stop or a budget cap — ends the wait rather than hanging it, while a message already in hand still wins over an in-flight stop and is not lost. The end-of-work check is covered separately: it takes an already-queued follow-up without waiting, reports none immediately on an empty chat so the agent can end itself, and reports none once the chat is closed, so a stale message never starts a new turn on a stopped agent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
