What the tests cover, against a real directory on disk:

- **Delivery in order** - a stop, a single-option pick and a multi-select pick appended to the control file reach the tailing agent in the order written, with who picked preserved; a Merge action round-trips the same way.
- **Reset before tailing** - truncating the file empties it, and a watcher started afterwards, as a fresh agent would, sees only entries appended after the reset, so an earlier agent's pick never replays.
- **What is skipped** - a line that is not JSON, an instruction of an unknown kind, a pick with an empty gate id, and a pick that is not a string or list of strings are all dropped, while a multi-select pick of nothing is delivered.
- **Messages** - a live chat message with text is delivered; an empty or missing text is dropped; extra fields on the line are ignored and the message is read for its text.
- **Handoff moves** - a handoff line with no rung, a rung nobody defines, or the retired pair of booleans is dropped rather than coerced, so a half-written line cannot disarm the agent's handoff, while a line naming a real rung is delivered.
- **Nothing transient is tracked** - in the repository's own checkout, no runtime state under `.the-framework/` is tracked by git; only the ignore file, the layout marker, `LOGS.md`, the conversations and the agent archives may be.
