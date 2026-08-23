What the tests cover: the materialized set is exactly the six quality presets, keyed by underscore file stem (`security_audit`, not the hyphenated preset name) so it matches the key prompts read; the on-disk location is `.the-framework/presets/<stem>.md`, workspace-relative; the stem→filePath map covers every materialized preset; and materializing writes every preset's text verbatim under the repo — creating the directory, and keeping the `${{ tf.params.what }}` target blank unrendered, since the queue entry tells the agent what to set it to.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
