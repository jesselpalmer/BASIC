# STARS on EDUSYSTEM-30

The [March 1975 printing, pages 207–208](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=207)
credits Bob Albrecht and supplies the listing and sample play. The pinned
[transcription](../scripts/package/fixtures/classic/stars.bas) contains 56
physical lines and has SHA-256
`dbb5dfd36512e1507df85806e478644e004ca5033a12c5ade944406028c6c005`.
The [reviewed fixture](../scripts/package/fixtures/classic/stars-mar75-text.bas)
restores the trailing semicolon on line 170 and the printed labels 580 and
590 for the jump after a loss and the following remark. Its SHA-256 is
`1121376962a0ffb59fe1a70c10174e195ef70a391781c70ebe4663930ce503cf`.

## Archived play

The [EDU30.SV capture](stars-edusystem30-reference.json) uses two fresh RUNs
with the RANDOMIZE clock word set to zero. The first shows the instructions,
then guesses against secret 23 exercise the thresholds for all seven hint
levels. The seventh miss reveals 23, and the next round uses the continuing
random stream. Guessing 27 wins on the first try and prints 50 stars. The
second RUN skips instructions and wins with 23 again. Both captures stop at
the next guess prompt.

Line 380 uses `ABS(X-G)` to count the distance from a guess to the secret.
The archived losing round includes guesses above and below the secret. The
transcript excludes terminal input echo and the OS/8 banner.

```sh
python3 scripts/research/capture-edusystem30-stars.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/stars-edusystem30-reference.json
diff -u docs/stars-edusystem30-reference.json /tmp/stars-edusystem30-reference.json
```
