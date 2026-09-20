What the tests cover, against a throwaway project on disk whose tickets provider is a real command that logs every call it answers:

- **Which command provides** - a project whose dependencies declare no tickets provider has no tickets; one whose dependency declares its own command is read through `<command> list --local`, and the rows come back as printed.
- **Reads are shared for five seconds** - two reads at the same moment are one call; a read within five seconds is no call; telling the reader the project changed makes the next read a call although the clock never moved.
- **A failed read is not kept** - a provider that prints no JSON reads as no tickets, and the read after it runs the command again.
- **The shape** - of an array, the objects with the five plain facts are kept in order; an object missing them, a bare string, nothing, and a row with an empty file name are dropped; anything but an array is no tickets.
