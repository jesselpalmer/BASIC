# TICTAC on the OMSI tape

## Book and tape

The [March 1975 printing, pages 218–220](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=218)
credits Tom Kloos of the Oregon Museum of Science and Industry. The printed
sample on page 220 identifies EDUSYSTEM-35. The
[pinned corpus transcription](../scripts/package/fixtures/classic/tictac.bas)
repeats label 130 for the opening two lines. The print and OMSI tape use
120 and 130. The corpus also drops a zero from the DATA table at 2150.
The print and tape preserve all 22 numbers required by the READ loop.

The [recovered OMSI listing](../scripts/package/fixtures/classic/tictac-edu30-tape.bas)
runs on archived EDUSYSTEM-30. The fixture removes the trailing space from
the empty REM at 830. The [portable listing](../examples/omsi/TICTAC.bas)
separates `650LET` into a label and keyword and inserts a space between
`TO` and `900` at line 1050. These changes preserve the tape's board,
random sequence, and game logic.

## Play TICTAC

Choose **TICTAC · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/), select **Run
program**, and enter moves as row and column pairs such as `1,1`.
Answer `1` to play again or `0` to return to DEMON. Enter
`TIC-TAC-TOE` there to start a fresh game.

The [archive capture](tictac-edusystem30-reference.json) preserves the full
computer win, three invalid moves, invalid replay answer, tie after replay,
and return to the menu. A launch from DEMON replays the printed moves
`3,1`, `1,1`, `2,3`, and `1,2`, and matches all four boards and the tie on
page 220.
The public library, CLI/editor, and browser acceptance tests replay the
archived transcripts and verify a fresh browser run. The tape replay gives
behavioral evidence for the EDUSYSTEM-30 listing. The print's EDUSYSTEM-35
sample remains a separate reference.

```sh
python3 scripts/research/capture-edusystem30-tictac.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/tictac-edusystem30-reference.json
```
