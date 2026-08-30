Analyze ${{ tf.params.what }} and look for opportunities to refactor code.

For each codebase subset that needs it, put the following entries on the queue with `tickets queue add "<entry>" --priority <N>` (from the `tickets` skill; usually a low priority) and replace <CODEBASE_SUBSET> with a clear designation.
- "Apply ${{ tf.presets.maintainability.filePath }} with tf.params.what set to <CODEBASE_SUBSET>"
- "Apply ${{ tf.presets.security_audit.filePath }} with tf.params.what set to <CODEBASE_SUBSET>"
