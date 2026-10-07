What the tests cover, for what the dashboard works out about subagents (`subagents.ts`):

- **An agent's subagents** - the agents whose card names it as their parent, oldest first, leaving out agents with another parent or none; an agent nobody names has none.
- **What a subagent is called** - the first line of what it was asked, without the lines every subagent is told; its branch when it was asked nothing.
- **Whether a subagent is over** - of the five statuses, only `running` and `waiting` are not over.
- **Whether a subagent holds its main agent's job** - one that is running, one that is saving, and one that ended, done or failed, in the last 10 seconds hold it; one that ended 10 seconds ago or more, and one that only waits, do not.
- **A list as a tree** - an agent whose parent is in the list sits under it, oldest first, and the other rows keep their order; an agent whose parent is not in the list is a row of its own; an agent started for a subagent is a row of its own, so the tree is one level deep and no row is lost; in a list pooling projects, a main agent is looked for in the same project only.
- **A subagent's end among the prompts** - the ended line about one of the agent's subagents reads as that subagent's end, with its status and the rest of the message; an end that says why carries the reason; the same words about an agent that is not one of these subagents, the ended line with words before it, and the ended line with no subagents given, each read as the user's.
- **When a subagent started** - the moment its id was made from, whatever start time its card carries now; the card's start time for an id that is no time.
- **Where a subagent's row goes** - before the first event written after it started, two subagents started in the same gap sharing the place in order, an event with no time passed over; a subagent started after the last event goes at the end; a subagent's row keeps its place when its card's start time moves past the next event.
