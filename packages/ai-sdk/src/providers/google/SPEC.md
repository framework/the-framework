The Google wing of the vendor layer: Gemini chat, embeddings, Imagen image generation, hosted files, and hosted document stores — one file per capability, assembled behind one factory sharing one configuration.

## TLDR

- Chat carries Google's flavor of prompt caching: prompt regions marked cacheable are stored with Google once, through a shared registry, and later requests send only what the cached copy doesn't already hold.
- Document stores are Gemini's hosted retrieval — Google chunks, embeds, and indexes documents server-side, and searches can be narrowed by attribute filters translated into Gemini's own filter language.
- Image generation maps the requested size onto the nearest aspect ratio Imagen supports, since Imagen thinks in ratios rather than pixels.
- The hosted document stores exist only on the Gemini API, not on Vertex AI.
- Google's SDK loads only when first used, so it stays an optional install for apps that never talk to Google.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
