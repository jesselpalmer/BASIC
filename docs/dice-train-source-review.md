# DICE and TRAIN source review

## DICE

The [March 1975 printing, pages 89–90](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=89)
credits Daniel Freidus and prints a frequency table for a two-dice simulation.
The [pinned transcription](../scripts/package/fixtures/classic/dice.bas) has
SHA-256 `b5d6fa09957b1f5eb780226c3e150dc6651a12e571290494adce94c0dea06e85`.
The [reviewed fixture](../scripts/package/fixtures/classic/dice-mar75-text.bas)
restores punctuation and trailing spaces on lines 40 and 70 and has SHA-256
`de62170bac304a92aaf766f6bc3bdb7232380cc3912d08595bfa00760970548a`.
The printed listing uses bare `RND` at lines 140 and 150, indexed numeric
storage, comma-separated `PRINT`, and a string response to the replay prompt.
The printed edition leaves the BASIC interpreter unspecified.

Archived EDU30.SV returns `S1 140`, `PC 150` and `S1 224` when compiling the
reviewed listing.

The [EDUSYSTEM-30 MARK adaptation](../scripts/package/fixtures/classic/dice-mark-adapted.bas)
changes bare `RND` to `RND(0)` and uses a single marked character for replay.
`Y` starts the next round. Other accepted characters end the session.
The [archive replay](dice-edusystem30-reference.json) captures all 11
frequency rows for 36 rolls and a 12-roll replay. A fresh 12-roll RUN
produces a different table because it starts at the original random seed.
The library, CLI/editor and browser match those complete transcripts.
The archive evidence applies to the adaptation. The printed listing's
original dialect and random sequence remain unverified.

Choose **DICE · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `36`, `Y`, `12`
and `N` to replay the archive session.

```sh
python3 scripts/research/capture-edusystem30-dice.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/dice-edusystem30-reference.json
```

## TRAIN

The [March 1975 printing, page 223](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=223)
credits Walt Koetke as the submitter and describes the earlier FOCAL program.
The printed BASIC interpreter remains unspecified.
The [pinned transcription](../scripts/package/fixtures/classic/train.bas) has
SHA-256 `f534b3620919f7c3d233d141266ecf2f500a21efce157ea7d19d49ce454f1239`.
The [reviewed fixture](../scripts/package/fixtures/classic/train-mar75-text.bas)
restores the closing parentheses on line 50, the semicolon on line 95, and
trailing spaces in printed literals. Its SHA-256 is
`08466c129864f4d474998caef2e2319f0280374e86915c658b4ea365db5df35d`.
The listing uses bare `RND` on lines 10, 15 and 20 and a string response to
repeat the exercise.

Archived EDU30.SV returns `S1 10`, `PC 15`, `S1 20`, `PC 25` and `S1 105`
when compiling the reviewed listing. The original source remains outside
the selected profile.

## Isolated archive probes

The archived interpreter accepts `RND(0)` and produces `S1` for bare `RND`
and `S2` for `RND()`. `INPUT A$` produces `S2`, while string assignment and
string equality each produce `S1`. These probes separate the source forms
from the diagnostics that follow them in the two full listings.

```sh
python3 scripts/research/probe-edusystem30-dice-train.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
