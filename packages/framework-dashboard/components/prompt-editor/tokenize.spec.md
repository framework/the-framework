Chip-ifies plain token strings already in the editor (#470) — e.g. from a just-loaded preset — by scanning text nodes for `TOKEN_PATTERN` matches and replacing each with a token node in one transaction.

## Facts

- Replacements are applied back-to-front so earlier offsets stay valid within the single transaction.
- Text carrying the `code` mark is skipped, so a `path/<SESSION_NAME>.md` inside inline code stays one verbatim span instead of being split around a chip.
