What the tests cover: totalling one agent's usage across its turns.

- **The starting point** - a fresh agent has zero tokens and zero turns, and no cost at all rather than a cost of zero, which would read as "this agent was free".
- **Adding turns up** - every token kind and the cost add up across turns, and the turn count follows.
- **Turns with no price** - a driver that reports token counts but never a price still totals its tokens and counts its turns, while the cost stays absent.
- **A mix of priced and unpriced turns** - the total is what is known to have been spent: the priced turns' cost, never silently dropped.
- **Reading the total** - a total read out is a snapshot; later turns do not change a total already read.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
