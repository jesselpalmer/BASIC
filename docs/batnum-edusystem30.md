# BATNUM on EDUSYSTEM-30

The [March 1975 printing, pages 32–33](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=32)
attributes the computer adaptation to John Kemeny. The pages leave the
original interpreter unspecified. The [pinned transcription](../scripts/package/fixtures/classic/batnum.bas)
has SHA-256 `c66b9a6302d7ca27f199eecf1a3e75a017d99365159d641bb60f94c1c63d6a7f`.
The [reviewed fixture](../scripts/package/fixtures/classic/batnum-mar75-text.bas)
restores the printed literals and the control-flow lines 350, 580, 640, 690,
730, 790, 880, 890, 980 and 1030. Its SHA-256 is
`6960df4706851d41b42e548b5191d5a31b12e241dd6c1a8d9d486a1c17db3741`.

## Archived execution

The [archived EDU30.SV transcripts](batnum-edusystem30-reference.json) cover
the three printed games in sequence. The computer loses the first game, the
player loses the second, and the player takes the last object to win the third.
A separate fresh `RUN` verifies zero pile and reversed-bound retries, an
illegal move, a zero-move forfeit, and a computer win. Each transcript ends
at the next pile prompt and excludes input echo, the OS/8 run banner and the
operator's interruption.

Choose **BATNUM · EDUSYSTEM-30 selected profile** in the
[playground](https://basic-playground-rho.vercel.app/). To play the first
printed game, enter pile `23`, win option `2`, bounds `1,3`, and start option
`2`. Then take `2` objects followed by `3` on each remaining turn. Use **Stop**
at the next pile prompt to leave the game.

```sh
python3 scripts/research/capture-edusystem30-batnum.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/batnum-edusystem30-reference.json
diff -u <(python3 -m json.tool docs/batnum-edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/batnum-edusystem30-reference.json)
```
