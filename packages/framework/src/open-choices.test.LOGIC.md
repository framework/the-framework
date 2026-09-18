Tests of the rule for which questions an agent still waits on (`open-choices.ts`).

Covered:
- A question stays open, whole, through the end of an agent that ended waiting on it, whatever cost line sits between.
- A question closes when the agent goes on after it, and a later question opens again.
- An agent that ends for good (stopped, or done) takes its question with it.
