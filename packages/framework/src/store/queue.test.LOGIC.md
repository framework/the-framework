What the tests cover, against a throwaway project on disk whose queue provider is a real command that logs every call it answers:

- **Which command provides** - a project whose dependencies declare no queue provider has no queue; one whose dependency declares its own command is read through `<command> --local`, and the entries come back as printed.
- **Reads are shared for five seconds** - two reads at the same moment are one call; a read within five seconds is no call; a read past five seconds is a call again; telling the reader the project changed makes the next read a call although the clock never moved.
- **A failed read is not kept** - a provider that prints no JSON reads as no entries, and the read after it runs the command again.
- **The shape** - of an array, the non-empty strings are kept, trimmed, in order; an object or a bare string is no entries.
