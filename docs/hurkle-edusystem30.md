# HURKLE on EDUSYSTEM-30

The March 1975 printing credits Bob Albrecht of People's Computer Company. Its
listing records David Ahl's conversion to RSTS/E in line 90. The archived
EDU30.SV runs the reviewed listing with its printed `RANDOM` statement at
line 105. [March 1975 printing, pages 135–136](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=135)

The pinned transcription contains 49 physical lines and has SHA-256
`0844c09f09d41a89b86af8be947bfec6b0769b1cecb65604075644be0e6b7c5e`.
The reviewed fixture removes the transcription annotations on lines 670 and
680 and restores spaces inside quoted output on lines 250, 270, 420, 430,
and 450. Its SHA-256 is
`7616322434de68eed19ea83980a63dd0c365a693d91eb4a09bc1abea5eb643e0`.
[Pinned transcription](../scripts/package/fixtures/classic/hurkle.bas)
[Reviewed fixture](../scripts/package/fixtures/classic/hurkle-mar75-text.bas)

## Archived play

A fixed clock word of 4 makes the first hidden point `(8,7)`. The opening
three guesses follow the printed sample and win after northeast and east
clues. The next round loses after five misses and reveals `(5,8)`. Automatic
replay continues the same random stream and wins with `(8,3)`. A fresh `RUN`
starts with `(8,7)` again. Each win emits ten BEL bytes from `CHR$(7)`.
Both transcripts stop at the next first-guess prompt and exclude terminal
input echo and the OS/8 banner. [Archived capture](hurkle-edusystem30-reference.json)

The capture repeats the fresh round with `RANDOMIZE` at line 105 and compares
its output byte-for-byte with `RANDOM` at the same clock word. The selected
parser recognizes both spellings as the same statement.

```sh
python3 scripts/research/capture-edusystem30-hurkle.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/hurkle-edusystem30-reference.json
diff -u <(python3 -m json.tool docs/hurkle-edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/hurkle-edusystem30-reference.json)
```
