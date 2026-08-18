How far a finished agent publishes itself — one ordinal covering keep it local, push the branch, open a pull request, merge it.

## TLDR

- One ladder, not three switches. The stages are strictly nested — a pull request needs a pushed branch, a merge needs a pull request — so three independent booleans described eight states of which four were reachable, and the implication lived in a doc comment because the type could not carry it.
- The impossible combinations stop being representable. "A pull request without a push" was never something an agent could honour; it used to be resolved by turning the push back on, which meant a launcher offering "publish nothing" could not deliver it.
- Unset means open a pull request: that is what makes the handoff zero-config, so work never sits on a local branch nobody is told about. Merging is the rung above, and landing on the default branch has to be asked for.
- A surface that still shows three checkboxes converts both ways, and the conversion is where an impossible answer resolves *downward* rather than being quietly repaired upward. Settings written before the ladder are read through that same conversion, since forgetting them would read "publish nothing" as the default — which publishes.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
