Executable entry point (`#!/usr/bin/env node`): calls `runCli(process.argv.slice(2))` and maps the result to `process.exitCode` (1 on an unhandled error).
