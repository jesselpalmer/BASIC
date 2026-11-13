# CUBE on EDUSYSTEM-30

## Book and corpus

The [March 1975 printing, pages 85–86](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=85)
credits Jerimac Ratliff and leaves the BASIC interpreter unnamed. The
description says side dimension 2, while the listing and printed moves use
coordinates 1 through 3. The book sample wins two $50 wagers and reaches a
third round. The original sample's random stream remains unverified.

The [pinned transcription](../scripts/package/fixtures/classic/cube.bas) has
SHA-256 `d17aa56fbd9fbc27dd6ba3a8a46605d2674b196d461b15e7a72444ca5be42ae0`.
The scan has extra spacing in the printed literals at 100 (before SEE)
and 240 (before AN ILLEGAL). The [runnable fixture](../scripts/package/fixtures/classic/cube-edusystem30.bas)
retains the pinned strings and control flow, separates compact LET, IF, and
THEN tokens, and joins GO TO. The archive also runs the unmodified corpus
source for the mine-loss case. The original interpreter remains unverified.

## Play and replay

Choose **CUBE · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `0` to skip
instructions or `1` to read them. Enter `1` at the wager prompt and choose an
amount to play the verified route. Submit moves as comma-separated coordinates.

The [archive capture](cube-edusystem30-reference.json) checks a rejected $600
wager, a six-move win for $50, an illegal diagonal move on replay, and a mine
loss after a fresh RUN. The library, CLI/editor, and browser compare the
entire transcripts with operator echo and monitor framing accounted for.

```sh
python3 scripts/research/capture-edusystem30-cube.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/cube-edusystem30-reference.json
```
