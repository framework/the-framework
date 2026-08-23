What the tests cover: text without any `${{ ... }}` fragment is reproduced byte for byte, including lone braces and dollar signs; a fragment is replaced in place by what its expression produces, several fragments can appear in one template, and results that are not text (numbers, booleans) are converted; a fragment reading whether autopilot is on renders the right branch for on, off, and not-set, with not-set treated as off; a rendered value containing characters that look like substitution patterns stays literal.

Failures: a fragment whose expression is not valid code aborts rendering, as does one that produces nothing — the typo guard — and the resulting error names the offending fragment.

The permanent rule that a fragment ends at the first pair of adjacent closing braces is pinned: an expression nesting braces that close together is cut short and fails, and separating those braces with a space renders the same expression correctly.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
