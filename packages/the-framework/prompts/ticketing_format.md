# Ticketing format


## tickets/<DATE>_<SLUG>.md

DATE: yyyy-mm-dd
SLUG: succinct kebab-case slug of the ticket title
Body:
```md
Status: open/closed
Priority: 0-10 [optional, 10: critical — act immediately, 0: only if capacity]
Topics: [list-of-topics] [optional]
GitHub: [#42](https://github.com/org/repo/issues/42) [optional]

# Ticket title

## TLDR

...

## Why it matters

...

[optional: more info (any heading and format you want)]
```


## tickets/<DATE>_<SLUG>.plan.md

For an existing ticket (e.g. `tickets/2042-01-01_some-ticket.md`), a plan can be created (`tickets/2042-01-01_some-ticket.plan.md`).

Body:
```md
Effort: 0-10 [0: implementation is trivial, 10: implementation takes months]
Uncertainty: 0-10 [0: implementation without meaningful alternatives, 10: highly uncertain how to implement]

# [Plan] Ticket title

Single-sentence describing this file's content.

## TLDR [optional]

Brief overiew of this file's content.

## Problems [optional]

List of all significant aspects with low confidence on how to implement, with explanation why uncertain.

## Solutions [optional]

For each problem, list of ways to solve the problem (including meaningful shortcuts, for quicker implementation).

## Considerations [optional]

Exhaustive list of all significant aspects to be considered (including edge cases).

## Implementation [optional]

Concrete plan to implement the ticket.
```

Notes:
- Covers both spiking (e.g. high-level research without implementation plan) and planning (e.g. concrete implementation proposal)
- The `.plan.md` file can be modified multiple times over an extended period (e.g. a ticket requiring repeated human intervention, transitioning from spiking to concrete plan)
- All sections are just proposals and optional: you can use any headings with any format
- The uncertainty value:
  - Gauges whether there are *significant* alternatives, minor variability such as syntax should be ignored
  - Is used for evaluating whether human intervention is needed (0 => clearly no human intervention needed)
- Example of how to gauge uncertainty and alternatives:
  - List all aspects that need to be considered
  - Give an uncertainty rating (0-10) to each aspect following this criteria: is there an obviously optimal way to implement it (0), or is it highly unclear whether it can be implemented in a better way (10)?
  - Explore and suggest alternatives for each aspect with a low rating
