# TRAIN EDUSYSTEM-30 MARK adaptation

The [source review](dice-train-source-review.md#train) preserves the March
1975 listing separately from the pinned transcription. The book describes an
earlier FOCAL program, but leaves the printed BASIC interpreter unspecified.

The [adaptation](../scripts/package/fixtures/classic/train-mark-adapted.bas)
uses `RND(0)` on lines 10, 15 and 20 and substitutes a single MARK character
for string replay input at lines 95 through 105. It keeps the printed
distance formula and the percentage calculation, which divides by the
submitted answer. Enter a positive number at the numeric prompt, then
`Y` for another problem or `N` to finish.

The [archive capture](train-edusystem30-reference.json) exercises an accepted
answer, a six-percent miss after replay, and a different fresh RUN. It pins
the clock word at the archive's RANDOMIZE entry and uses the same entropy
through the public host in the acceptance tests. Normal play keeps the
host's default entropy. The capture removes input echo and SIMH monitor
messages and retains exact program output.

```sh
python3 scripts/research/capture-edusystem30-train.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/train-edusystem30-reference.json
```
