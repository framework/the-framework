Round-trips `CODE-OVERVIEW.md` — the canonical, human-editable, diff-friendly form — to/from the `CodeOverview` data.

## TLDR

- `serializeOverview` — `# Code Overview` title, then the summary paragraph, then each section as `## Title` + body, joined by blank lines with a trailing newline; blank titles/bodies are skipped.
- `parseOverview` — tolerant inverse: normalizes CRLF, ignores the top-level `# ...` title line, treats text before the first `##` as the summary, and starts a section at each `## Heading`; empty input yields an empty overview.

## Facts

- The format is deliberately markdown (not JSON) so a maintainer *or a person* can hand-correct the file; the round-trip is lossless for well-formed content (asserted in tests).
