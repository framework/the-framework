Switches the browser tab's icon between two files so the tab alone says whether The Framework is working: the plain mark (`/logo.svg`) while no agent [1] is running anywhere, and the brand's animated color variant (`/logo-animated.svg`) while at least one agent is. The animation lives inside the icon file itself, so a backgrounded tab keeps moving without the page doing anything.

The page ships with an icon already declared, so the switch repoints that declaration rather than adding a second one; when the page declares none, one is added. Writing the same icon twice is avoided, because re-declaring an icon restarts its animation in some browsers, which would leave the mark stuttering instead of turning. Which agents count is the same question the animated mark in the dashboard answers, and it is asked across every project: an agent running in another project still means The Framework is working for the user.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
