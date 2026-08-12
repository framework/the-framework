Node-only conveniences for feeding local files to the AI SDK.

The SDK's main entry runs in any JavaScript runtime, so anything that touches the local filesystem is quarantined here behind its own entry point. Today that means turning a local file path into a document or image attachment, or into an audio transcription — read the file, work out what kind of content it is, and hand it to the runtime-agnostic machinery.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
