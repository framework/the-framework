The domain presets shipped with the package — one folder of pure markdown per domain, each a pickable bundle of the quality discipline that domain works under.

## TLDR

- Five ship: Software Development (the stack-agnostic flagship), Web Development, Data Science, Product Management, and Biological Science; a new folder with a manifest becomes a discoverable preset automatically.
- Each folder tells one story: the manifest gives the preset its name and pitch, the loops say what fires after which kind of change, and the prompts are the bodies of those checks.
- All five share a shape: a substantial change runs three domain-specific reviews; a bug fix confirms the root cause then locks the fix in with a regression test.
- Every major-change review ends with a machine-readable blockers verdict — an empty list means passing — so the loop can gate on what the review concluded, not on whether it merely ran.
- Each preset ships a Technical Control variant of its major-change loop: a hands-on developer gets only the check most worth automating and drives the remaining depth themselves.

## Rationales

- Presets are prose so a domain expert or the community can sharpen a check — or contribute a whole new domain — with a pull request that touches only markdown.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
