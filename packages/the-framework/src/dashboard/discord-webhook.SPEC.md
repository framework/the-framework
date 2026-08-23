Posts one message to a Discord webhook: the single transport behind both Discord notification feeds (the interventions "needs you" posts and the activity posts). The message is clamped to Discord's 2000-character limit with a visible truncation marker — Discord rejects an over-long message outright, so an unclamped batch would silently post nothing. It is separate from the bot-token Discord API: a webhook needs no token and reaches one fixed channel. Delivery never throws: a rejected post and a network error both resolve as "not delivered", for the calling watcher to log.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
