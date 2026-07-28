Chip strip under the launcher showing what a session will actually run with (#842), including values inherited from the repo's committed `the-framework.yml` that the gear menu can't change.

## TLDR

- Renders the same `OptionRow[]` the gear (OptionsMenu) renders, filtered to checked+enabled — strip and menu can never disagree.
- Prepends chips for `fileConfig.preset` / `fileConfig.event`, the two yml keys with no preference counterpart, always marked repo-tier.
- A chip whose `sources[key] === 'repo'` gets a dashed border + "repo" suffix; tooltips distinguish "From this repo's the-framework.yml" vs "Your setting, from the options gear".
- Renders nothing when no chips apply.

## Decisions

- Only "not yours" is highlighted: repo-inherited values are the surprising part worth marking, per the header comment.
