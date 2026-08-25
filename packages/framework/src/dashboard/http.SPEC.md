The request and response conventions every non-RPC HTTP surface of the daemon follows — the browser bridge, the web-start queue, and the device relay.

A failure is answered as a plain-text status line; a payload is answered as JSON. A request body is read up to a size cap and refused past it rather than buffered, so a caller cannot make the daemon hold an unbounded amount of data: a body over the cap is rejected as too large, and one that is not valid JSON is rejected as not JSON, so the caller learns which of the two it hit. A route that only accepts one HTTP method answers "method not allowed" for any other, naming the method it does accept.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
