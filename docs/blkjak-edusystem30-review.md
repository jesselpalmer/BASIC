# BLKJAK on EDUSYSTEM-30

The [March 1975 listing on printed page 42](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=42)
is titled BLKJAK. Its sample run banner reads `BLJACK EDUSYSTEM 30`.
It corresponds to the corpus [`blkjak.bas`](../scripts/package/fixtures/classic/blkjak.bas),
SHA-256 `7f1a2e9c60e540534ab1aebacb8784e380a8b83a8e542649981d685278eecbac`.
The corpus file named [`blkjac.bas`](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/blkjac.bas)
starts with an instructions prompt and corresponds to the separate BLKJAC
listing beginning on printed page 39.

The [reviewed BLKJAK source](../scripts/package/fixtures/classic/blkjak-mar75-text.bas)
restores the printed prompts and punctuation, line labels 115 and 990, the
initial total at 201, the card value `I` in player and dealer assignments,
calls at 119 and 768, the dealer bust comparison at 222, and the position of
`+1` inside `INT` at 780. Its SHA-256 is
`11528649c4ec186854d46879a210f85fbef8960cfd9dd0a4fee40eb271d7d607`.

## Archived execution

The archived compiler reports `UL 730` for the pinned transcription's
undefined subroutine target. The reviewed listing calls line 780 at that site.

The [reference capture](blkjak-edusystem30-reference.json) sets the clock
word to zero just before the listing's `RANDOMIZE` reads it. The sample in
the book leaves the original clock word unspecified. These two deterministic
reference runs use the reviewed text and the archived interpreter with SIMH's
default mark input parity.

- Starting with $200, the player tries wagers of $500 and $5, then wagers $20.
  The first deal is 3 and 4, with a jack showing. The player stands and the
  dealer busts. The player replays with $30, hits on 17, draws 5, and exits
  with $190 and the $10 loss summary.
- A fresh RUN repeats the first deal. The player quits after winning the
  $20 wager and receives the $20 profit summary.

The digest includes BASIC output and prompts. It excludes terminal input
echo, the OS/8 banner, the simulator's tape notices, and the return to
`READY`. The archived stand path transfers from the hit subroutine at
line 766 to dealer play at line 212.

## Character conversion boundary

Under mark input parity, `INPUT $K` stores 206 for uppercase `N` and
matches the source literal `#N`. Under space parity, the same input stores
78 and differs from `#N`. The source literal has value 206 in both cases.
[LETTER](classic-source-review.md#letter) uses space parity in its archive
capture and compares input to low ASCII values.

The BLKJAK capture also tests numeric arguments to `CHR$` on the seven-bit
output terminal. A variable with value 65, positive fractional values 65.5
and 65.9, and values 193, 321, and −63 all produce `A`. The probe produces
`B` for 66.1, BEL for 7, and `@` for −63.75 after rounding down.

The reviewed listing runs through the library, portable CLI/editor and
[browser playground](https://basic-playground-rho.vercel.app/) under
`edusystem-30-mark`. Choose **BLKJAK** and enter a starting bankroll.

```sh
python3 scripts/research/capture-edusystem30-blkjak.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/blkjak-edusystem30-reference.json
```
