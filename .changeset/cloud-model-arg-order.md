---
'@gemstack/the-framework': patch
---

Fix "Run on: Claude web" failing with `--cloud requires a description` on any account that has a model preference set. The description is `--cloud`'s own value rather than a loose positional argument, so the `--model` flag was claiming the slot and the prompt never arrived. The prompt now sits directly after `--cloud`.
