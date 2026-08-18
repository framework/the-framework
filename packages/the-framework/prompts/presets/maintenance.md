Analyze ${{ tf.params.what }} and look for opportunities to refactor code.

For each codebase subset that needs it, add following entries to TODO_AGENTS.md (usually as low priority; the queue lives on the data branch — see "The data branch") and replace <CODEBASE_SUBSET> with a clear designation.
- "Apply ${{ tf.presets.maintainability.filePath }} with tf.params.what set to <CODEBASE_SUBSET>"
- "Apply ${{ tf.presets.security_audit.filePath }} with tf.params.what set to <CODEBASE_SUBSET>"
