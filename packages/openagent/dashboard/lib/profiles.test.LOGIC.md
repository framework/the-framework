What the tests cover:

- **Saving, listing and removing a device** - a saved device survives in this browser's storage and is read back after a reload; the list reads newest first; removing one leaves the others.
- **One entry per machine** - saving a machine that is already saved replaces it and keeps its token up to date, instead of leaving two entries for one machine.
- **The label** - a device saved without a label is labeled by its host and port.
- **Reading a pasted address** - the origin and the token are pulled out of the address a machine prints, extra path and query are discarded, surrounding whitespace is ignored, and an address with no token saves with an empty one. A paste that is not a web address, one with no scheme (`localhost:4200/?token=…`), and one on a scheme other than `http` or `https` are all refused rather than saved as an unusable device.
- **The connecting address** - the device's token rides the address for the one hop that authenticates it, and a device with no token connects to its bare origin.
- **Carrying the prompt across** - the text in the composer travels with the hop, with or without a token, so switching machines never loses it. A draft too long to carry is dropped and the hop still connects; the length is measured on the encoded form, so multibyte text is judged by what it actually costs.
- **Hopping** - picking a device navigates the browser once, to an address carrying both the token and the draft.
- **Which daemon is connected** - a loopback address reads as "Local" and is marked as this machine; a saved device's address reads as its label; an address belonging to no saved device reads as its bare host.
- **"Local"** - it returns to the loopback address the dashboard was opened on, falling back to the default daemon address when none was remembered; an address that is not loopback is never remembered as this machine's.
