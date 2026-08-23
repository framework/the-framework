Names which presets materialize to disk and where. The six quality presets (maintainability, readability, security_audit, research, ux, maintenance) land at `.the-framework/presets/<stem>.md`, workspace-relative because that is the agent's working directory; the stem uses underscores (`security_audit`), unlike the preset's hyphenated name, and doubles as the key prompt templates use to reference a preset's file path (`tf.presets.<stem>.filePath`). This module holds membership only — the prompt templates live in the preset catalog — and is free of Node built-ins so the dashboard can render presets in the browser.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
