What the tests cover:

- **The gear's dot** - with an option on, the gear shows a presence dot and its tooltip ends with "on"; no number is shown on the button.
- **Writing through** - ticking a row writes its preference at once (ticking "Browser" writes the browser preference on).
- **Disabled rows** - a disabled row shows its reason in its text and cannot be toggled: clicking it writes nothing.
- **The "Run on" submenu** - picking "GitHub Actions" reports the `actions` location; the submenu is absent when no location control is supplied, as on an agent's page.
- **One flat list** - "Run on" has no "A device I have" header and no separate "Local" row; it lists the three location rows, the saved device with its URL, and "Add a device…"; the device rows and "Add a device…" are absent without a device list.
- **"Claude web"** - it is a real, enabled target; picking it reports the `web` location and clears the device selection; when it is the current location the checkmark sits on it and not on "This machine".
- **Where the checkmark sits** - on this machine's own dashboard with no device selected, on the current location only; with a device selected, on that device and on no location row; when the dashboard is connected to a device, on that device and on no location row.
- **Picking a device** - clicking a device row selects it for the next start, with no navigation and nothing written to the preferences.
- **"This machine"** - while connected to a device it returns to this machine's own dashboard and reports no location; on this machine's own dashboard it reports the `local` location, clears the device selection and does not navigate.
- **Adding and removing devices** - "Add a device…" opens the add flow; the X on a device row removes that device without selecting it.
- **Reachability** - an offline device reads "offline" and its row is dimmed; an online device shows its status dot and is not dimmed.
