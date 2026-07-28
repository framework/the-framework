OpenAI speech-to-text (Whisper) adapter via SDK `audio.transcriptions.create` with `response_format: 'verbose_json'` so `language` and `duration` come back.

## Facts

- The audio buffer is wrapped as a `File` hardcoded to name `audio.mp3` / type `audio/mpeg` regardless of the actual format; optional `language` and `prompt` pass through.
