# CHECKR source review

The March 1975 description, listing and sample occupy pages [73–75][book].
The author is Alan J. Segal of Roslyn, New York. No interpreter or monitor is
identified. BASIC-PLUS is a candidate execution system because of the scalar
string INPUT/comparison and the archived observations below; this does not
establish the original interpreter.

The [raw fixture](../scripts/package/fixtures/classic/checkr.bas) preserves the
pinned upstream bytes. The [reviewed listing](../scripts/package/fixtures/classic/checkr-mar75-text.bas)
restores these visible printed differences:

- At 1100 the third DATA item is `1`, not `-1`, and one extra zero before the
  later `-1` is removed. The printed sequence has sixteen board cells and the
  sentinel 15; it repeats to form the twelve pieces on each side.
- At 15100 the printed comparison is `<>-2`, rather than `=-2`.
- At 4300, 6600, 6700, 10300, 11500, 14200, 14300, 18300 and 18400 the digit-zero
  transcription in `T0` is restored to the keyword `TO`.

The fixture also separates compact labels/keywords and FOR bounds with spaces,
and adds a final newline. It retains the printed duplicate assignment at
17500–17600, the FOR counters started immediately before RETURN at 18300–18500,
and the source's warning about double/triple jumps. No game-rule repair or new
move validation is introduced.

## Bounded archived execution

The [reference](checkr-rsts-reference.json) loads and lists the complete reviewed
program on rebuilt RSTS V4A-12 MA2 and archived V04B-17. Both produce the same
bounded transcript: the first computer move, a requested board, rejection of
empty square `(0,0)`, the legal human move `(1,3)` to `(2,4)`, a second computer
move, and another board. Capture stops at the next FROM prompt. This is an
opening-position check, not a completed game, kinging test or winning playthrough.

An isolated EDU30 probe containing the listing's scalar string comparison
reports `S1 20` before requesting input. This rules out direct use of that
statement on the pinned EDU30 image; it does not identify CHECKR's original
interpreter. The selected-profile implementation needs DATA/READ/RESTORE, nested
GOSUB/RETURN, and numeric coordinate-row INPUT. These support requirements are
separate from identifying the original interpreter.

## Complete archived game

The separate [complete-game reference](checkr-complete-reference.json) loads
and LIST-verifies the same reviewed 192-line source on both RSTS builds.
Twenty-four human turns end with `VERY GOOD, YOU WIN!` and `-CHUCK OUT` after
the computer has no available move. Every computer move is checked against
the recorded coordinates, and every requested board is retained byte for byte.
The monitor's final blank line before Ready is recorded separately from program
output; the last printed CHUCK OUT newline remains in the acceptance transcript.
The human makes nine single captures and promotes one piece; the printed `O*`
king marker appears on eleven subsequent boards. An empty FROM square and an
occupied TO square both retry before the first valid human move.

The fixed input sequence was found by an offline single-move search, then
replayed on each unmodified archived interpreter. The archived interpreter,
rather than that search, supplies the output oracle. The shipped reviewed
source adds no board initialization, move repair or forced ending. The printed
warning about multiple jumps still applies. This is a complete selected-system
replay and does not identify the original interpreter.

Choose **CHECKR · BASIC-PLUS reviewed source** in the playground. Type `YES`
to see the board, then enter FROM and TO coordinates as comma-separated pairs,
such as `3,3` and `2,4`. The public acceptance helper compares the complete
archived transcript and a fresh RUN; the editor checker also saves and reloads
the exact selected document. The browser checker plays the full game, starts
fresh and stops at the next board prompt.

```sh
python3 scripts/research/capture-checkr-complete.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --pdp8 /path/to/simh/BIN/pdp8 \
  --tape /path/to/edu30.tu56 --output /tmp/checkr-complete-reference.json
```

CHECKR remains part of the 108-file gate; its raw original-dialect certification
and original interpreter attribution remain open.

```sh
python3 scripts/research/capture-checkr-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --pdp8 /path/to/simh/BIN/pdp8 \
  --tape /path/to/edu30.tu56 --output /tmp/checkr-rsts-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=73
