ElevenLabs provider — premium text-to-speech and speech-to-text; it offers no chat, so text generation is refused with a clear message.

## TLDR

- For speech generation the model string names the voice, not the speech model — the voice is what apps vary per call, while the underlying speech model is a per-deployment setting with a sensible default.
- Only the audio formats ElevenLabs actually produces are offered; asking for another format fails with a clear suggestion rather than silently returning the wrong bytes.
- The neutral speed knob is ignored because ElevenLabs has no equivalent — failing over from another speech provider still produces audio, just at default speed.
- Transcription returns the text plus the detected language and the audio duration.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
