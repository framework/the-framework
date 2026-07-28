The run Context picker (#439/#314) as a dropdown on the launcher's "In play" row (#1046): tick other repos to narrow focus, review/remove picked files.

## TLDR

- Replaced an inline disclosure that pushed the whole form down when opened; a dropdown stays folded until asked for.
- Projects section: checkbox per registered repo other than the current one (#665), checked against the `context` set by path; the label tooltip clarifies ticking narrows the agent's focus — it can still reach every repo.
- Files section: embeds `ContextFiles` for the `#`/tree-picked files, each removable via the same `onToggle`; empty hint points at `#` and the Files tab.
- Trigger shows a summary ("2 projects · 1 file") in primary color when anything is picked; `h-8` matches the Presets button beside it.
