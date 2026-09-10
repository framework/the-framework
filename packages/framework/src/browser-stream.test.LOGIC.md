What the tests cover, for the live stream of the agent's browser:

- **Which page is shown** - the agent's current tab is the most recently used one, not the first it ever opened; targets that are not pages and tabs with no debugger socket are skipped; a browser with no page yields nothing.
- **Input mapping** - a click is a press and a release; typed text is inserted as text, non-ASCII included; a click without finite coordinates, empty text, or an unknown input type maps to nothing; a navigation is accepted only for `http` and `https` addresses, never `javascript:` or `file:` ones.
- **Frame framing** - each frame is wrapped as a multipart part carrying its content type and length.
- **Serving the screencast** - starting the stream starts Chrome's screencast and serves it as a motion-JPEG stream; a frame that arrived before anyone looked is delivered the moment a pane connects, so a still page does not sit blank.
- **Posting input** - a posted click reaches Chrome and is answered with no content; a body that is not JSON is answered as a bad request and dispatches nothing.
- **Loopback only** - the stream's address is on this machine's loopback interface, since the frames can show a password being typed.
- **Surviving a bare browser** - a browser with no page yields no pane rather than a failed agent; a browser whose page list cannot be read yields none either.
- **Announcing the page** - the page attached to is announced; a navigation in the same tab is announced; polling the same page again announces nothing; a tab switch announces the new tab's page; a browser idling on a blank page still streams but announces nothing.
- **Following the agent's tab** - when the agent opens another tab the stream re-attaches to it and stops the old tab's screencast; a browser that stops answering the page list leaves the pane serving the page it already had.
- **Repeating the frame** - a still page's single frame is re-sent so the pane paints; the repeat stops writing when nobody is watching, and a viewer leaving does not take the stream down.
- **Closing** - closing stops the screencast and frees the port, and closing twice is harmless.
