An agent tool that lets the model search hosted document stores (RAG), with an optional fallback to searching the application's own database.

## TLDR

- On a provider with native file search, the search runs on the provider's servers and the findings land straight in the model's answer — no tool round-trip.
- On every other provider the same tool appears as an ordinary callable tool; configuring the fallback wires it to the local similarity search over the application's own data.
- Either way the agent's prompt and tool are identical, so an app can swap hosted RAG for self-hosted without retraining or rewording the agent.
- Result filtering accepts a plain key-equals-value shorthand that expands into the provider's full filter language.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
