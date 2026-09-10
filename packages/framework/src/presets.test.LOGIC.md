What the tests cover:

- **The materialized presets** - exactly the six quality presets (maintainability, maintenance, readability, research, security audit, UX), keyed by their underscore file stem, so `security_audit` is the key a prompt reads and "Maintenance" materializes like the rest so a scheduled entry can point at it by path.
- **Where they live** - the directory is `.the-framework/presets` and a preset's path is `.the-framework/presets/<stem>.md`, relative to the checkout.
- **What a prompt can read** - the map from stem to path covers exactly the materialized presets, each at its path.
- **Materializing** - the directory is created and every materialized preset is written verbatim under it, with the target blank left unrendered so the queue entry can tell the agent what to set it to.
