What the tests cover:

- **Recognizing a token in text** - a tag and a call are found anywhere in free text, and letter case does not decide what counts, so what a loaded preset offers up as chips is what typing the same text offers.
- **What is not a token** - a stray `<` or `>` in prose, an empty tag, a tag starting with a digit, and a bare `show()` are all left alone.
- **Normalizing a recognized token** - a catalogued tag or call takes its canonical spelling however it was written, so a loaded or typed `<await>` becomes `<AWAIT>`; an unknown one keeps exactly what was written, as a tag or, when it ends in a call's brackets, as a call.
