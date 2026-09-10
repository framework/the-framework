What the tests cover:

- **Pipe tables** - rows with a separator as the second row render as a real table with column headers and cells; pipe rows without a separator stay prose, shown as typed; a short row leaves its missing cells empty instead of collapsing the column.
- **Links** - `[text](url)` renders a link to that URL that sends no referrer; a bare URL becomes a link; a `javascript:` target stays plain text; a URL inside backticks stays literal code and is not linked.
- **Compact** - the compact form renders its body in the small text size, and its headings smaller than the full-size form's.
