What the tests cover:

- **The live file** - the message being written is in the live file as its newest text and never in the diary; once the whole message arrives the live file is gone and the diary has only its `said` line.
- **Ending mid-message** - a log ended while a message is being written removes the live file, and the diary has only its `ended` line.
