Lets one preset adapt to the user's working mode: a content file can ship mode-specific variants, and the variant whose declared modes are all active replaces the base file.

## TLDR

- A variant sits next to its base file, shares its name, and declares the modes that must all be active for it to count; with no modes active only base files apply.
- Among the eligible candidates the most specific one wins (the most matched modes); the base is the fallback when no variant matches.
- The shipped use: Technical Control mode swaps a full check chain for a leaner one, because a hands-on developer drives the depth themselves.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
