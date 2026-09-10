What the tests cover, for the "Add a device" dialog:

- **A pasted `?token=` URL saves a device** - pressing "Add device" saves the device with the daemon's origin as its URL and id, its host and port as the default name and the token from the URL, tells the caller a device was added, and closes the dialog.
- **A URL without a token cannot be saved** - "Add device" is disabled and the dialog explains that the URL has no token.
- **A typed name wins over the host default** - a device saved with a name in the name field carries that name.
