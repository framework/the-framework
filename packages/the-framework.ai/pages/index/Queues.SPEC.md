The second of the two building blocks in "How it works": the two queues the product runs on.

The "AI Queue" — the agent queue — holds the upcoming tasks; humans add to it, and so do agents themselves (on their own when there is no uncertainty, otherwise after the human confirms). The section makes the point that agents populating this queue is what makes the AI autonomous, and that the queue is nothing more exotic than a `TODO_AGENTS.md` file in the user's git repositories.

The "Human Queue" holds the pending human reviews, filled whenever an agent needs the user to settle an important decision whose options have subtle trade-offs. It is presented as the user's cockpit — what keeps humans in control.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
