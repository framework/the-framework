What the tests cover, for the "Discord notifications" dialog:

- **A save carries only the webhook** - saving a pasted webhook URL sends it to the daemon under the webhook's own key, so any other credential the daemon holds is left alone.
- **Refused before the round trip** - text that is not a URL is flagged ("not a URL") under the field and "Save" stays disabled, so nothing malformed is sent.
- **The switch is Discord delivery** - pressing "Enable" turns on the preference [1] that posts notifications to Discord, and nothing else.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
