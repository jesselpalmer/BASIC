# KINEMA source review and EDUSYSTEM-30 adaptation

The [March 1975 printing, page 137](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=137)
credits Richard F. Pav with shortening Huntington Computer Project's KINERV.
The page leaves its BASIC interpreter unspecified. It prints three trials
with initial velocities of 15, 21 and 22 meters per second.

The [pinned transcription](../scripts/package/fixtures/classic/kinema.bas)
omits a closing parenthesis on line 110 and changes spacing and punctuation
in several PRINT literals. The
[reviewed transcription](../scripts/package/fixtures/classic/kinema-mar75-text.bas)
restores those details. It preserves `PRI` and the unclosed quote on line
508, along with the compact `GOTO520` at line 509.

The archive returns `ST 508` for the reviewed listing. An isolated `PRI`
produces `ST 10`, and an unclosed `PRINT` string produces `UQ 10`.
It accepts compact `GOTO520`, `GOSUB50` and `GO TO70`.

The separately labeled
[EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/kinema-edu30-adapted.bas)
expands line 508 to `PRINT` and closes its quote. The
[archive capture](kinema-edusystem30-reference.json) starts at 12 meters per
second and verifies a two-correct round, a three-correct round, a zero-correct
fresh run and automatic restart. The printed page's sample uses a different
initial sequence. Its original interpreter and RNG sequence remain unverified.

Choose **KINEMA · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter one answer per
prompt. The drill gives a fresh problem after every third answer. Select Stop
to end the session.

```sh
python3 scripts/research/capture-edusystem30-kinema.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/kinema-edusystem30-reference.json
```
