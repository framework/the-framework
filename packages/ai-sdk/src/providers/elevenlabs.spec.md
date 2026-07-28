ElevenLabs provider — premium TTS + STT over raw `fetch` (#B9); no chat-completions surface (`create()` throws).

## TLDR

- `ElevenLabsProvider` (name `'elevenlabs'`): `createTts()` → `ElevenLabsTtsAdapter`, `createStt()` → `ElevenLabsSttAdapter`.
- TTS: the model string after `elevenlabs/` is a **voice id** (default Rachel `21m00Tcm4TlvDq8ikWAM`); the actual TTS model comes from `ElevenLabsConfig.defaultTtsModelId` (default `eleven_multilingual_v2`). POST `/v1/text-to-speech/{voice}?output_format=...` returns raw audio bytes.
- STT: multipart POST `/v1/speech-to-text` with `model_id` (only model today: `scribe_v1`) and optional `language_code`; `duration` derived from the last entry of the response's `words[].end`.

## Decisions

- Raw `fetch`, no SDK peer dep — ElevenLabs's REST API is small enough that an SDK adds weight without leverage (matches the Jina/Voyage shape).
- Model string is treated as the voice id because voice is the per-call discriminator apps vary; the TTS model is a stable deployment knob — the result's `model` field echoes the voice id for the same reason.
- `TextToSpeechOptions.speed` is ignored — ElevenLabs exposes no top-level speed multiplier (only `voice_settings`, out of scope for v1); failover from OpenAI TTS produces default-speed audio.
- Only `mp3` (`mp3_44100_128`) and `opus` (`opus_48000_128`) formats are supported; `wav`/`aac`/`flac` throw with re-encode guidance instead of silently mismatching.

## Facts

- Auth header is `xi-api-key` (not Authorization/Bearer); base URL `https://api.elevenlabs.io`, overridable via `config.baseUrl`.
- Voice resolution order for TTS: per-call `options.voice` → model-string voice id → `DEFAULT_VOICE_ID`.
- STT audio is always uploaded as a Blob typed `audio/mpeg` named `audio`, regardless of actual input format.
