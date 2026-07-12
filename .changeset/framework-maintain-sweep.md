---
"@gemstack/framework": minor
---

Add `framework maintain` (#298): a background maintenance sweep. It walks the registered repos, and for each that has grown commits since its last review it runs the maintainability loop on them (`framework prompt`, budget-capped by `--max-cost`, bounded by `--max-repos`). A first-seen repo is baselined (recorded, not reviewed retroactively); per-repo review state lives in `.the-framework/maintenance.json`. `--dry-run` previews the plan. Also exports the maintenance API (`assessRepo`, `planMaintenanceSweep`, `maintainSweep`, review state helpers).
