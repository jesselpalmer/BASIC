# GOLF on archived EDUSYSTEM-30

The [March 1975 printing, pages 109–110](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=109)
credits Howard Kargman and explicitly identifies DIGITAL EduSystem 30. The
description names DECUS BASIC 8-560 and instructs the operator to enter
`NOLINE` before `RUN`.

The [pinned transcription](../scripts/package/fixtures/classic/golf.bas)
has SHA-256 `e6eb8ea402a4fab51cdd62de4d42ca33ced97c74fd0efcc9fd886ffe66f15fce`.
The [reviewed listing](../scripts/package/fixtures/classic/golf-mar75-text.bas)
has SHA-256 `b6a6f7810e7f648aaae559e150ece86360532d8d33d08478e2fbca49f4f10d50`.
It restores the character input and constants at 130–150, the course
distance array `A` at 380, 410 and 490, the bound `N(10)` at 440, the
score subscript `M(Q,J)` at 1000, and the club-range multiplications at
1140–1280. It also restores the printed PRINT separators and wording. The
right edge of the directions question on line 120 is clipped. The printed
sample supplies its ending, `N FOR NO`. The reviewed file separates adjacent
tokens with spaces for readability. The archive capture removes those
spaces outside quoted strings before entering each line.

## Archived playthroughs

The [reference capture](golf-edusystem30-reference.json) pins two completed
two-hole games on stock EDU30.SV. With clock word 0, the game skips directions
when answered `N`, rejects five players, then finishes with 9 and 11 strokes
for two players against par 9. It includes a shot in the rough. With clock
word 660, answering `Y` displays directions, and the round includes two
traps, three extra trap prompts, water with a one-stroke message, and a sunk
shot. The final total is 11 strokes against par 9. The capture excludes
keyboard echo, the OS/8 banner, and the transition back to `READY`. The
clock word makes each capture reproducible; the book's five-hole example
does not identify its clock word.

## Prerequisite evidence

The capture includes independent cases for the remaining selected-profile
work.

- **Character constants and input parity.** The compiler emits marked ASCII
  values for `#` followed by the character. For example, `#N` and `#Y` produce
  206 and 217. Default MARK input of `N` produces 206 and compares equal to
  `#N`. SPACE input produces 78 and follows the other branch. The
  [LETTER archive replay](classic-source-review.md#letter) uses SPACE
  parity and compares its input with codes 65–90.
- **Numeric DATA and READ.** READ consumes the prepared pool across
  backslash-separated and comma-separated targets, including indexed
  targets. DATA remains available when execution jumps past its line.
  Subtracting source literals from values READ from DATA gives zero,
  including `1.8`, `- 1.8`, `0.03`, and `.51`. The compiler rejects
  explicit leading plus in DATA with `S1`. Marked character literals such
  as `#N` and `-#Y` retain their compiled numeric values. DATA can share a
  line with other backslash-separated statements, and bare RESTORE rewinds
  the pool. Exhaustion prints
  `ERROR DA AT LINE 0030` and stops before the following PRINT.
- **Rank-two numeric arrays.** `DIM M(4,18)` admits zero and the declared
  inclusive bounds on each axis, retains separate cells, and supplies
  zero for unread cells. `M(4.5,18.5)` is accepted. `M(0,-.5)` reports
  `ERROR SS AT LINE 0030`.

The reviewed listing runs through the library, portable CLI/editor and
[browser playground](https://basic-playground-rho.vercel.app/) under
`edusystem-30-mark`. Choose **GOLF** and answer N to skip directions, or Y
to display them. The verified playthroughs cover two-hole games.

```sh
python3 scripts/research/capture-edusystem30-golf.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/golf-edusystem30-reference.json
```
