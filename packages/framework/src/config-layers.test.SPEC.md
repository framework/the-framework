What the tests cover: for each setting, the nearest configuration tier that actually set it wins — any of the four tiers can win, and a tier that left a setting unset neither shadows a farther tier that set it nor counts as a decision. An explicit "off" in a nearer tier beats an "on" in a farther one. With every tier silent, or with no tiers at all, the defaults hold — vanilla and transparent off, the handoff at the `pr` rung — and no setting claims a deciding tier. The repo tier carries only the settings `the-framework.yml` actually names. The startup summary lists each decided setting with its value and the tier that decided it, and is empty when nothing was configured anywhere.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
