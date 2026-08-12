Caches embeddings in memory — keyed by model and text, oldest evicted at a size cap — so repeated inputs skip the provider call, while reported usage stays what the provider actually charged for the misses (zero only when everything was cached).

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
