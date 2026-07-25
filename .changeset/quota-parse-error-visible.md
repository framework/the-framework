---
'@gemstack/the-framework': patch
---

A quota readout whose week can't be placed is now an error in the usage panel — "Couldn't parse quota", quoting the reset text that failed — instead of the week quietly degrading to a plain figure. The silent fallback hid a real defect: the boundary (and with it unattended work) was gone, and nothing on screen said so.
