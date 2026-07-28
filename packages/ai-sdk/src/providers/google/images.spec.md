Imagen image-generation adapter via the raw REST `:predict` endpoint (`generativelanguage.googleapis.com/v1beta`, API key in the query string) — bypasses the `@google/genai` SDK entirely.

## Facts

- Named sizes (`square`/`landscape`/`portrait`) map to pixel dimensions, which are then sent as `aspectRatio: '<w>:<h>'` (e.g. `1024:1024`); `n` → `parameters.sampleCount`.
- Response images come from `predictions[].bytesBase64Encoded`; only base64 results are produced (no URLs).
