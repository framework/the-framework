---
"@gemstack/the-framework": patch
---

Make the settings page obey the same run-option rules as the launcher (#958).

The settings page rendered the run options as flat, independently checkable boxes, while the launcher has real rules between them. So the page could show an option checked that the launcher shows off, and allowed combinations that mean nothing: Eco under Vanilla (nothing left to trim), Browser on Codex (inert, the browser rides Claude Code's MCP config), Auto maintenance without Post-merge cleanup, and anything under Transparent, which overrides the lot.

The table and its rules moved out of the composer into one module both surfaces render, so a rule cannot hold in one place and not the other. A row the rules disable is greyed and shows why, rather than disappearing, since the settings page is where you go to look for a setting. `checked` is now the effective value everywhere, so no surface claims an option is on while the run ignores it.

Two smaller cases of the same thing: the notification rows now show the delivery capability the bell already showed (browser permission blocked, `DISCORD_WEBHOOK` / `DISCORD_BOT_TOKEN` unset), and the spend offset is bounded to the same range as its slider and the sanitizer, instead of accepting a value that was silently clamped on save.
