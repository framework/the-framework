---
"@gemstack/the-framework": minor
---

Give every routine on the Overview its own checkbox, so the scheduled sweep can be narrowed to the routines you actually want it spending quota on. Unticking is what gets saved (`autoPmOptOut`), so every routine stays on by default and one added by a later version runs without anyone re-visiting the setting. An unticked draining routine stands the sweep down rather than falling through to the rotation, and an unticked maintenance sweep leaves its calendar untouched so it still comes due once it is ticked back on.
