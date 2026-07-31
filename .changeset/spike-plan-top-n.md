---
'@gemstack/the-framework': patch
---

[Spike & plan] now queues plan work for the `<COUNT>` most important tickets instead of every open one, with `COUNT: 10` as the prompt-defined default (#1421). The parameter lives in the prompt itself, following the prompts' own placeholder-footer convention, so changing the default — or overriding it from a derived prompt — is a one-line prose edit.
