# SALVO 1 on EDUSYSTEM-30

The [March 1975 printing, pages 196–197][book] credits Martin Burdash and
describes a slightly modified version of his submission. The upstream inventory
suggests BASIC-8. The original interpreter remains unverified.

The [pinned listing](../scripts/package/fixtures/classic/salvo1.bas) preserves
the [upstream bytes][upstream]. The
[EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/salvo1-edusystem30.bas)
uses the printed blank-line loop at 350, restores the separate branch labels
820 and 860, and restores the semicolon on the placement prompt at 480.
It also separates line number 520 from its statement.

The adaptation splits the four placement targets into successive numeric
`INPUT` statements to fit the selected profile's three-target limit. Stock
EDU30.SV accepts four targets and carries surplus numeric fields into the
next `INPUT`, so the player can still enter all four placements in one
reply. The listing retains its garbled line 900 and increments the hit
counter even when the player repeats a successful shot. Use distinct shots
to play by the book's rules.

The [archive captures](salvo1-edusystem30-reference.json) cover a player win
and a fresh run that ends in a loss. Both use the stock interpreter with
known clock words for `RANDOMIZE`. The transcripts include all prompt,
board and outcome text and are replayed through the installed library,
CLI/editor and browser.

Select **SALVO 1 · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter four distinct
positions from 1 through 25, separated by commas, then enter one outpost
number at each shot prompt.

```sh
python3 scripts/research/capture-edusystem30-salvo1.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/salvo1-edusystem30-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=196
[upstream]: https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/salvo1.bas
