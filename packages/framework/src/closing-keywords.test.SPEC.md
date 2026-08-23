What the tests cover: every closing keyword GitHub accepts (`close`/`fix`/`resolve` in each tense, any case) is defused while the sentence keeps its words; the issue reference itself is never rewritten, so it stays a clickable link that still cross-references on the issue's own timeline; the cross-repo `owner/repo#123` form is defused too; an issue mentioned without a keyword, a word that merely ends in a keyword, and a reference already inside backticks are all left alone; and running the rewrite twice changes nothing the second time.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
