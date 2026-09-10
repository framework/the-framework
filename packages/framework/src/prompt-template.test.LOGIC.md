What the tests cover:

- **Text without placeholders is untouched** - markdown with single braces and dollar signs renders byte for byte.
- **Evaluating placeholders** - a placeholder reading a context value is replaced by that value; a ternary renders either branch, and a missing flag counts as off; several placeholders in one prompt all render, including one computing from the others; a number or a boolean result is written as text.
- **Results are literal** - a value containing replacement-pattern characters such as `$&` or `$1` is written exactly as is.
- **A broken placeholder fails the render** - an expression that is not valid JavaScript fails the render; an expression evaluating to undefined, such as a misspelled name, fails it and the error carries the expression as written; the error message names the failing expression.
- **A placeholder ends at the first adjacent `}}`** - an expression whose nested object closes with two adjacent braces is cut short and fails, and the same expression with a space between the two braces renders as written.
