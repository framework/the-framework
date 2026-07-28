The choice-gates rail (#440, part of #314): every gate the run is parked on, stacked as one scroll in the right rail.

## TLDR

- Renders a `ChoicePanel` per `ChoiceRequest`, keyed by `choice.id`; the first (topmost) is `active`, so Ctrl+Enter accepts it unambiguously.
- With more than one gate, a sticky top nav of numbered chips scrolls (`scrollIntoView`) to each panel; panel elements are tracked in a `Map` ref.
- Gates clear themselves as `choice-resolved` events stream in (the parent's `pendingChoices` drops them); an empty list renders "No choices to make right now."
- Forwards `runId` (#749) so each pick resolves against the right run.
