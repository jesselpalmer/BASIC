# BULEYE source review

The March 1975 description and listing, pages [57–58][book], credit Digital
Equipment Corporation; the listing credits Dave Ahl. Its string arrays, multiple
assignment, statement separators and statement modifiers identify a BASIC-PLUS
source family. No original interpreter version is printed, so that attribution
remains unverified.

The [raw corpus fixture](../scripts/package/fixtures/classic/buleye.bas) preserves
upstream bytes. The [reviewed text](../scripts/package/fixtures/classic/buleye-mar75-text.bas)
restores the single comma after `CONTROLLED OVERARM` at 80 and places the
semicolon after the player number at 130. It normalizes backslash separators to
colons and adds the final newline. The original comment spelling is retained.
The printed line 350 repeats `W(M)` for each winner, rather than using `W(I)`;
that behavior remains unchanged. Likewise, the printed `W(10)` dimension remains,
even though the introduction allows twenty players.

## Archived complete game

The [reference](buleye-rsts-reference.json) compares the complete reviewed program
and [portable adaptation](../scripts/package/fixtures/classic/buleye-ma2.bas) on
rebuilt RSTS V4A-12 MA2 and archived V04B-17. All four outputs agree byte for byte,
excluding monitor banners, operator echo and the monitor's final newline.
`RANDOMIZE` is omitted for the archive's default stream; the shipped game retains
it and public acceptance supplies a zero entropy word.

Two named players, ADA and BEN, play eleven complete rounds. Negative and
above-range throws retry without consuming a random draw. The three throw
strategies produce misses and all four scoring zones. ADA reaches exactly 200;
BEN completes that round with 190, and the game prints ADA's winning score and
its farewell. Fresh RUN repeats the full transcript.

The adaptation expands multiple assignment, inline assignment/PRINT modifiers,
logical OR, ON dispatch and inline IF bodies into ordinary assignments, FOR/NEXT
and line-target branches. Player names pass through scalar `INPUT A$` before
assignment to `A$(I)`. This preserves the tested single-field player names and
integer throw choices 1–3, as well as the negative/above-range retries. It does
not establish every BASIC-PLUS INPUT scanning rule or ON dispatch edge case.
In particular, the printed source admits zero through its range guard and stock
MA2 then reports `ON STATEMENT OUT OF RANGE`; the adapter's dispatch is only
verified for integer choices 1–3. Zero, fractional throws and multiple simultaneous
winners remain outside this bounded acceptance, and are not evidence of raw
original compatibility.

## Play BULEYE

Choose **BULEYE · BASIC-PLUS adaptation** in the [playground][playground]. Enter
a player count and names, then choose integer throw 1, 2 or 3 for each player.
The first player to reach 200 at the end of a round wins. The installed library,
CLI/editor and browser compare the same complete archived transcript.

```sh
python3 scripts/research/capture-buleye-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/buleye-rsts-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=57
[playground]: https://basic-playground-rho.vercel.app/
