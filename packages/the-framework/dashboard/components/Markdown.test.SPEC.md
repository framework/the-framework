What the tests cover: pipe tables render as real tables with headers and cells, rows of pipes lacking the header separator stay prose instead of becoming a mangled table, and a row with fewer cells than the header leaves the missing cells empty rather than collapsing a column.

Links: `[text](url)` and bare web addresses become links that open without leaking the referrer; a `javascript:` target stays plain text and produces no link at all; and a URL inside backticks stays literal code.

Compact mode: the body and its headings render a notch smaller than their full-size counterparts.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
