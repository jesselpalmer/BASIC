# HORSES on the OMSI tape

## Book and tape

The [March 1975 printing, pages 133–134](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=133)
describes the author as unknown. Its listing and sample run are on page 134.
The [pinned corpus transcription](../scripts/package/fixtures/classic/horses.bas)
adds label 4 and changes line 5 from the printed race heading to
`PRINT "POST 2\35"`. Line 25 in print reads `IF U(S)>0 THEN 28`;
the corpus reads `IF U(S)<0 THEN 26`. The corpus repeats 114 with an
extra PRINT and ends 234 with a stray `k`. The print shows one 114
and ends 234 with a semicolon. The printed listing's original interpreter
remains unverified.

The [recovered OMSI listing](../scripts/package/fixtures/classic/horses-edu30-tape.bas)
runs on archived EDUSYSTEM-30. The book accepts four numeric fields per bet
and ends with STOP. The tape prompts separately for the horse, a word for
the position, the wager, and whether to bet again. It then returns to
DEMON. The [portable listing](../examples/omsi/HORSES.bas) separates
`120PRINT` and `THEN2070` and joins `GO SUB` at six sites.
It retains the tape's numeric INPUT into `T(S)` and `V(S)`, character
INPUT, race logic, and GOSUB into the lexical FOR body.

## Play HORSES

Choose **HORSES · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/) and select
**Run program**. Enter `2`, `WIN`, `5`, and `NO` for a $5
losing wager, or enter `HORSES` at the DEMON menu to start another race.
The browser keeps the original editor source when a program chains.

The [archive capture](horses-edusystem30-reference.json) records direct
entry and entry from DEMON. Both runs cover eight sets of standings, the
payout table, settlement, and return to DEMON. The menu run retries an
invalid horse and wager, accepts two bets, and reports $37.62 in total
winnings. The public library, CLI/editor, and browser checks compare the
archived transcripts. The browser check also stops at the menu and reruns
the editor source. The tape replay leaves the printed four-field listing's
behavior open.

```sh
python3 scripts/research/capture-edusystem30-horses.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/horses-edusystem30-reference.json
```
