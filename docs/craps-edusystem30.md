# CRAPS on EDUSYSTEM-30 MARK

## Book and adaptation

The [March 1975 printing, pages 83–84](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=83)
describes a CRAPS version that circulated among DIGITAL users. It leaves
the original author and interpreter unspecified. The corpus inventory's
BASIC-8 label remains an attribution lead.

The [pinned source](../scripts/package/fixtures/classic/craps.bas) and
[reviewed transcription](../scripts/package/fixtures/classic/craps-mar75-text.bas)
are preserved separately. The book starts the bankroll at
`5*INT(10+11*RND(0))` on line 210 and places the dice's addition inside
`INT` on lines 470 and 480. The review also restores punctuation and spacing
at the rules, readiness, first-shooter, and repeat-roll messages. Stock
EDU30.SV reports `S1 216` for each of the two string comparisons in both editions.

The [MARK adaptation](../scripts/package/fixtures/classic/craps-mark-adapted.bas)
uses a single character for the readiness prompt. `N` prints the repeat
message and redisplays the rules. `Y` starts play. It retains the
printed bankroll, wagers, rolls and shooter decisions. The last line
halts after the game's final output. The printed `CHAIN$ "DEMOES"` is
outside this adaptation because that companion program is absent from the
pinned EDUSYSTEM-30 tape.

## Related OMSI tape edition

The pinned two-drive tape contains [DOMINO](../scripts/package/fixtures/classic/craps-domino-edu30-tape.bas),
a related edition that retains the printed wagers, dice and outcomes. It
omits the opening RANDOMIZE, readiness loop and quit instruction. At the
end it chains to the available `DEMON` menu, whereas the printed listing
names `DEMOES`. The LIST capture strips one trailing space outside a quoted
string on line 660. DOMINO is source evidence for the relationship. The
standalone MARK adaptation preserves the book's opening flow and is the
version tested here.

## Play the archived adaptation

Choose **CRAPS · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `Y` to start,
then enter whole-dollar wagers. A wager of `0` ends the session.

The [archive capture](craps-edusystem30-reference.json) checks the complete
adapted runs on stock EDU30.SV. Clock word 0 covers repeating the rules,
a fractional wager, an excessive wager, point rolls, a seven-out and
shooter change, wins and losses, and voluntary exit. A fresh run at
clock word 17 covers an opening point win followed by bankruptcy.
The archive strips host echo and simulator framing. Acceptance uses the
same clock words through the public host, while normal play uses host
entropy. The time-dependent printed sample's sequence remains unverified.

```sh
python3 scripts/research/capture-edusystem30-craps.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/craps-edusystem30-reference.json
```
