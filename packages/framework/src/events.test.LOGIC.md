What the tests cover, across the pick normalization in `events.ts` and the terminal's one-line rendering of each event in `terminal.ts`:

- **Normalizing a pick** - a single option id becomes a one-item list; a chosen subset stays the same list; an empty subset and an empty id both become an empty list.
- **The gate as a terminal line** - a checklist renders "? <question>" and one indented line per option marked "[x]" or "[ ]" by whether it starts checked; a single-select gate marks the recommended option "●" and the others "○".
- **The session id line** - "session abc123", with " — <link>" appended once a session link is known.
- **The forwarded prompt line** - the coding agent's turn start shows the prompt text itself ("› prompt: Build this app end to end"), not just "prompt sent"; a long prompt is cut to well under 160 characters and ends in an ellipsis.
- **The end line** - "✓ finished", "■ stopped", or "✗ failed: <detail>", so a stop never reads as a failure.
- **The usage line** - "spend: $0.0400 over 2 turns", with "turn" in the singular for one; when the coding agent reported tokens but no price the line reads "tokens: 12,224 (6 out) over 1 turn — no price reported" and carries no dollar sign, because a "$0.0000" would read as free rather than unknown; the token total is the input, cache-read and output tokens together.
- **The quota line** - "· quota allowed (five_hour)", "! quota running low (five_hour)" and "✗ quota exhausted (five_hour)" by the reported status, each followed by the reset time as an ISO timestamp; a status never seen before still renders as "quota <status>" rather than vanishing or crashing.
