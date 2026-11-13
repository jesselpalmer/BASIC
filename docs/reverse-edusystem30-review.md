# REVERSE source review and EDUSYSTEM-30 MARK adaptation

The March 1975 edition of _101 BASIC Computer Games_ credits Bob Albrecht
of People's Computer Co. on [page 180][description]. The listing and sample
on [page 181][listing] leave the interpreter unspecified.

The [pinned corpus source](../scripts/package/fixtures/classic/reverse.bas)
and [reviewed March listing](../scripts/package/fixtures/classic/reverse-mar75-text.bas)
are separate fixtures. The reviewed listing restores label 180, the reversal
loop variable `K` at 410, and the swap temporary `Z` at 420. It preserves
the printed reference to a missing label 520.

The [archived compiler capture](reverse-edusystem30-reference.json) records
the errors for both sources. Stock `EDU30.SV` rejects the printed bare
`RND` calls and string handling, and reports `UL 520`. The separately
labeled [MARK adaptation](../scripts/package/fixtures/classic/reverse-mark-adapted.bas)
uses `RND(0)`, a separate PRINT before numeric INPUT, marked `Y` and `N`
for the rules and replay, and the existing farewell at label 560 as the
zero-move target. It keeps the shuffle, prefix reversals, move count and
win test from the reviewed listing.

The archived playthrough verifies the rules, a move above nine, a one-item
reversal, every board through a win, a replay with the continuing random
stream, and a zero-move exit. A fresh RUN skips the rules and verifies a
second starting board and exit. The clock words are controlled for
reproduction. The starting boards and moves in the printed sample were
recorded under different conditions.

Choose **REVERSE · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `Y` to see the
rules. Enter a number from 1 to 9 to reverse that many items from the left,
and try to put the list in ascending order. Enter `0` to finish.

```sh
python3 scripts/research/capture-edusystem30-reverse.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/reverse-edusystem30-reference.json
```

[description]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=180
[listing]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=181
