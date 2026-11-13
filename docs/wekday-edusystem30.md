# WEKDAY on the OMSI tape

## Book and tape

The [March 1975 printing, pages 234–235](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=234)
credits Tom Kloos of the Oregon Museum of Science and Industry for adapting
the GE timesharing program. Line 241 of the book listing identifies
PDP-11 BASIC. At line 140 the book prints `INPUT M1,D1,Y1`, while the
[pinned corpus transcription](../scripts/package/fixtures/classic/wekday.bas)
has `INPUT M1,D1, 1`. At line 490 the book compares
`(Y1*12+M1)*31+D1` against the other date. The pinned transcription
instead uses `(Y1*12+M1)-31*D1`. Line 550 in the book prints the entered
date's year `Y` with a separator before the following text. The
transcription has `Y1` and omits that separator.

The [recovered EDUSYSTEM-30 tape listing](../scripts/package/fixtures/classic/wekday-edu30-tape.bas)
changes the prompts, expects full years, and returns to the OMSI DEMON
menu via CHAIN. For the book sample's first date pair, it reproduces the
Wednesday and age calculation. The tape uses different text for the time
breakdown and gives its own output for every field. The archived run
verifies the tape edition. The book's PDP-11 interpreter version remains
unverified.

The [portable source](../examples/omsi/WEKDAY.bas) separates `710IF`
into the line label and keyword. It preserves the tape's printed
strings and calculations. The two trailing spaces stripped from the
archived LIST body occur outside quoted strings. The
[reference capture](wekday-edusystem30-reference.json) records the
hashes before and after that normalization.

## Play WEKDAY

Choose **WEKDAY · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/) and select
**Run program**. Submit the current and comparison dates with full years,
such as `6,12,1973` and `5,17,1939`. The program reports date facts and
returns to DEMON. Enter `WEEKDAY` at that menu to run again, or select
**Stop program** to leave the session.

For the CLI, export the example as a portable document and supply the
packaged OMSI source directory:

```sh
bun ./bin/basic --chain-dir examples/omsi /path/to/wekday.basic.json
```

The acceptance tests compare full archived transcripts, including launches
directly and through DEMON and the return to the menu.

```sh
python3 scripts/research/capture-edusystem30-wekday.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/wekday-edusystem30-reference.json
```
