Runs the SDK's hosted document stores on OpenAI — create and manage stores, attach and detach files — with OpenAI chunking, embedding, and indexing everything server-side.

## TLDR

- A file arrives either as one OpenAI already holds or as a local file, which is first uploaded to OpenAI's file storage and then attached.
- Indexing runs in the background on OpenAI's side, so attaching by default polls until it completes or a time budget runs out — or returns immediately on request.
- Detaching a file (or deleting a store) leaves the uploaded file in OpenAI's file storage; deleting it there is a separate step.
- OpenAI's answers are reshaped into the SDK's neutral store and file forms, including the error message when ingestion failed so callers see why.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
