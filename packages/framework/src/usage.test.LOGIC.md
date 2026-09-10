What the tests cover:

- **The starting total** - every token count and the turn count start at zero, and there is no cost at all rather than a zero cost.
- **Summing** - each token count and the cost are summed over the turns, and the turns are counted.
- **No price reported** - an agent whose turns report real token counts but no price totals its tokens and turns and still has no cost.
- **A cost from the turns that had one** - when some turns carry a price and others none, the cost totals the priced ones and every turn counts.
- **Snapshots** - a total read earlier does not change when later turns are added.
