What the tests cover: a project with no layout marker runs ungated; a marker matching this build passes; a marker differing in even one recorded name refuses, and the refusal names the marker file, both layouts, and how to fix it. The marker is pure data — one name and value per line, with no prose whose rewording could change the comparison — and it lives at `.the-framework/LAYOUT`. Finally, The Framework's own repository is held in lockstep: its checked-in marker must equal what this build derives, so a change to any layout name fails until the marker is regenerated.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
