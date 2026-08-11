Voyage provider — best-in-class embeddings and reranking; asking it for text generation fails with a clear message pointing at what it is for.

## TLDR

- Voyage embeds better when told whether text is a search query or an indexed document; the default is "document" because indexing is the common case in retrieval pipelines, with a per-deployment override for the query side.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
