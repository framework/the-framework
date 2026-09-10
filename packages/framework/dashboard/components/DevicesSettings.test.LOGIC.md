What the tests cover, for the "Devices" section of Settings:

- **An empty roster says so** - with no device [1] saved the section reads "No devices saved" instead of showing an empty list.
- **Each device is listed with its address** - a saved device's row shows its label and its URL.
- **Removing a device** - the row's "Remove <label>" button drops the device from the browser's storage.
- **Removing the targeted device clears the target** - when the removed device is the one selected as the next agent's [2] target, that selection is cleared; removing a different device leaves both the selection and the other devices untouched.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
