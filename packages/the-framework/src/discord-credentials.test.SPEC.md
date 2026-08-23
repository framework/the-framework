What the tests cover: where the Discord webhook comes from, what the dashboard is told about it, and what saving one does.

Precedence: the daemon's environment wins over a value stored in the registry, the stored value is used when the environment sets none, a blank environment variable does not shadow a stored value, and no value anywhere means no credential.

What the dashboard is told: which credential exists and which of the two sources it came from — and nothing that can be turned back into the credential itself. An unset credential is simply absent. The environment variable's name is reported so the dashboard can say who owns the value.

Validation: a webhook URL is accepted, including one on a self-hosted proxy rather than Discord's own domain; something that is not a URL and a URL that is neither http nor https are refused with their reasons; and clearing is always allowed.

Saving: a saved credential is written and afterwards reads as stored; a cleared one disappears. The daemon is asked to pick the change up only after the write has landed, so the rebuild can never read the value it is replacing — and a rebuild that fails does not fail the save, which stays stored. A credential the environment already sets is refused by naming that environment variable, and nothing is written. An invalid credential is refused before anything is written. A credential set in the environment still reads as configured, attributed to the environment.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
