What the tests cover:

- **A prompt arriving in the address is moved out of it** - a prompt carried in the page's address is put aside for the launcher and erased from the address, while every other parameter in the address is left untouched.
- **The launcher takes it once** - the carried prompt is handed over the first time it is asked for and is gone the second time, so a reload does not fill the composer again.
- **No prompt, no change** - opening the dashboard with no carried prompt leaves the address exactly as it was and hands the launcher nothing.
