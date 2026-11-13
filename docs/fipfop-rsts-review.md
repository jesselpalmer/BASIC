# FIPFOP source review and archived RSTS probes

The [March 1975 description and listing, pages 99–100](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=99)
credit Michael Kass and identify David Ahl's RSTS/E conversion. The printed
sample shows two completed boards, with 13 moves before a YES replay and 12
before a NO exit. The original RSTS/E version and sample random draws remain
unverified.

The [pinned transcription](../scripts/package/fixtures/classic/fipfop.bas) and
[reviewed listing](../scripts/package/fixtures/classic/fipfop-mar75-text.bas)
are separate fixtures. The printed listing uses `&` for four instruction lines,
a string array for the board, `PRINT ... FOR` for each row and a string replay
response. The reviewed copy restores the semicolon before the numeric input,
the trig expressions and assignments at 420–440 and 530, and the board updates
and branches at 460, 490, 510 and 560–570.

## Archived execution

The [V04B-17 capture](fipfop-rsts-reference.json) verifies that the printed
listing reaches its opening prompt, retries after input 12, resets the board
with 0, starts a new puzzle with 11, and flips the first position. The archived
BASIC-PLUS reports `MODIFIER ERROR at line 530` while entering the printed
`COT` expression and prefixes that line with `?` in LIST. Repeating the first
move reaches that line and reports `ILLEGAL STATEMENT at line 530`.

The separate [fixed-Q archive probe](../scripts/package/fixtures/classic/fipfop-v4b-probe.bas)
sets `Q=.125` at 190 and expands `COT(x)` into `1/TAN(x)` at 530. It
solves two eight-move puzzles on V04B-17, including a repeated move through
the rewritten expression, a YES replay and a NO exit. The capture checks
every resulting board and pins the full console output with operator echo
and the date banner removed. Fixing Q gives a reproducible comparison and
does not establish the printed sample's random sequence.

Archived EDU30.SV rejects the printed listing, including its ampersand
abbreviation, string board, trig expression at 530 and inline FOR modifier.

## Varying-Q replay on both BASIC-PLUS builds

The [cross-build capture](fipfop-randomized-reference.json) checks V4A-12
software MA2 and V04B-17. The replay replaces the unsupported `COT(x)` with
`1/TAN(x)` and bypasses clock seeding so that each build draws the same
default random sequence. It keeps the printed string board, inline PRINT
FOR, SIN, COS and TAN, and both trig paths. The opening, restart with 11,
and YES replay draw distinct Q values. The latter two puzzles each solve
in six moves, including consecutive repeated positions. Both interpreters
produce the same full transcript.

The formula probe separately captures both secondary flip positions for
all ten moves at each of the three exact Q values. Additional Q values
from the [archived RNG domain](rsts-v4a-ma2-rng.md) show why evaluating the
formulas with direct binary64 arithmetic changes play. At Q=1/32768 and
move 8, both builds return ordinary secondary position 7. Direct binary64
evaluation returns 3. At Q=9/32768 and move 9, both secondary positions
differ. Q=57/32768 and move 3 demonstrates a difference on the repeated
path alone. These cases establish the need to reproduce archive evaluation
of the formulas, including the precision of intermediates. For the first
case, both archives confirm the tangent operand is exactly 262136 and
print `TAN(262136)` as `13.5567`. Binary64 tangent of that same
operand is about 16.1575, so rounding the binary64 result to 24 bits
cannot reproduce the archived tangent.

```sh
python3 scripts/research/capture-fipfop-randomized.py \
  --simulator /path/to/pdp11 --v4a-disk /path/to/raw.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/fipfop-randomized-reference.json
```

## Play the fixed-Q adaptation

Select **FIPFOP · BASIC-PLUS fixed-Q adaptation** in the
[playground](https://basic-playground-rho.vercel.app/) and enter positions
1 through 10 to flip the row from X to O. The documented archive solution is
`1, 2, 2, 4, 5, 7, 8, 10`. Enter `YES` to replay or `NO` to finish.
The fixed-Q edition keeps the original prompt for 11, which starts another
round with the same flip rules.

The [portable source](../scripts/package/fixtures/classic/fipfop-ma2-fixed-q.bas)
uses ordinary PRINT and FOR statements and a numeric board. It replaces
the two trig paths with secondary-position tables observed on archived
V04B-17 at `Q=.125` for all ten inputs, including repeated moves.
The board check counts O cells before branching, so each FOR completes.
Both the fixed-Q archive probe and the portable source produce the same
stock V04B-17 transcript through invalid input retries, reset, restart,
two solved boards, replay and exit. The installed library, CLI/editor
and browser verify that replay and fresh RUN under the selected BASIC-PLUS
profile. The original listing's randomized puzzle generation and
general BASIC-PLUS trigonometry, inline FOR modifiers and string arrays
remain separate compatibility work.

```sh
python3 scripts/research/capture-fipfop-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --disk /path/to/RSTS11v4B.DSK \
  --edu30-simulator /path/to/simh/BIN/pdp8 --edu30-tape /path/to/edu30.tu56 \
  --output /tmp/fipfop-rsts-reference.json
```

See the [NICOMA archive notes](nicoma-source-review.md#archived-rsts-v04b-17-replay)
for the provenance of the V04B-17 disk.
