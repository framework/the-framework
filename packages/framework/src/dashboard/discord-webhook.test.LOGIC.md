What the tests cover:

- **Clamping** - a message over Discord's 2,000-character limit is posted cut to the limit, marked as truncated, and still counts as delivered.
- **Delivery verdict** - a non-success answer from Discord counts as not delivered; a network error counts as not delivered instead of throwing.
- **A long "needs you" batch** - forty interventions with long titles and URLs go out as one clamped message within the limit rather than silently posting nothing.
