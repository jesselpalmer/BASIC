# HI-LO source review and EDUSYSTEM-30 MARK adaptation

The [March 1975 description][book] credits Dean Altman and describes a
six-guess high/low jackpot game. The [listing and sample run][listing]
do not identify the interpreter.

The [pinned corpus copy](../scripts/package/fixtures/classic/hi-lo.bas) omits
blank PRINT statements from the introduction and turns line 280 into an
unterminated string. The [reviewed transcription](../scripts/package/fixtures/classic/hi-lo-mar75-text.bas)
restores the printed introduction and `PRINT\IF B<6 THEN 200` on line 280.
The raw archive run reports `UQ 280`. Both sources report `S1 180` at
bare `RND` and `S1 360` on the replay line. Both also report `PC 200`
for the unmatched parentheses left by the rejected expression.

The [MARK adaptation](../scripts/package/fixtures/classic/hi-lo-mark-adapted.bas)
uses `RND(0)` and changes the replay prompt to accept one marked letter.
It preserves the original comparison's behavior. `Y` replays and another
response finishes the session.

The [archive capture](hi-lo-edusystem30-reference.json) verifies both
clues, wins of 22 and 26 for a cumulative 48, six missed guesses that reveal
36 and clear the total, a new win of 78, and quit. A fresh RUN with clock word
17 verifies a zero jackpot. The adaptation retains the listing's
`INT(100*RND)` rule, which can produce zero even though the directions
describe a jackpot between one and one hundred dollars. The book's sample
random stream remains unverified.

In the [playground](https://basic-playground-rho.vercel.app/), choose
**HI-LO · EDUSYSTEM-30 MARK adaptation**. Start with `50`, then narrow
the range with the clues. Enter `Y` to replay or `N` to finish.

```sh
python3 scripts/research/capture-edusystem30-hi-lo.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/hi-lo-edusystem30-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=124
[listing]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=125
