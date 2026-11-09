# NUMBER on EDUSYSTEM-30

The [March 1975 printing, page 162](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=162)
labels the listing **NUMBER EDUSYSTEM 30**. The pinned [transcription](../scripts/package/fixtures/classic/number.bas)
has 36 physical lines and SHA-256
`ac9327a25a1dde2c233dba8a09711ce1af537f93d362cc01fb8842d313d0e5e6`.
The [reviewed fixture](../scripts/package/fixtures/classic/number-mar75-text.bas)
restores one space in the title on line 1 and one trailing space inside the quoted
text on line 7. Its SHA-256 is
`131e582b14e81b35861f6ef0fc69e6977bd1ac4da24640098dcca248bb576ab2`.

## Archived play

Two fresh [EDU30.SV captures](number-edusystem30-reference.json) agree byte for
byte. Both run the reviewed source through the printed sample and a supplemental
game in the same archived interpreter session, with a new RUN for each game.

| Path              | Observed result                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Printed sample    | Eight guesses of 3 then nine of 2 reproduce every printed score, three jackpots and a 716-point win.                                                                                                                |
| Supplemental game | A guess of 1 halves 101 to 50.5. A guess of 6 advances the random stream and repeats the prompt without printing a score. The next guess doubles 50.5 back to 101. Four jackpots take this game to a 912-point win. |

Each transcript ends at the final END. The capture excludes terminal echo,
the OS/8 banner and the terminal newline before READY. The library, installed
CLI/editor and browser can use these transcripts to check the same branches.
The halving branch uses the literal `.5`.

```sh
python3 scripts/research/capture-edusystem30-number.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/number-edusystem30-reference.json
diff -u docs/number-edusystem30-reference.json /tmp/number-edusystem30-reference.json
```
