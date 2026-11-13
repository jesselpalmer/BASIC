# GUESS source review and EDUSYSTEM-30 adaptation

The March 1975 [listing](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=113)
appears on printed page 114. The [description](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=114)
on printed page 115 identifies DIGITAL EduSystem 20 BASIC and notes its
three-letter command abbreviations. It credits Walt Koetke for converting
a FOCAL program from _Computers in the Classroom_.

The [reviewed transcription](../scripts/package/fixtures/classic/guess-mar75-text.bas)
preserves the printed labels, abbreviations, and punctuation.
The [pinned corpus copy](../scripts/package/fixtures/classic/guess.bas)
renumbers printed lines 10–73 into 9–36 without updating the branch targets.
For example, its line 14 still jumps to 25, now a win-assessment condition
in place of the printed guess comparison. The review restores the printed
wording, labels, and branch locations.

Archived EDU30.SV rejects the printed three-letter commands with `ST`
diagnostics. The separate
[EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/guess-edusystem30.bas)
expands `PRI`, `INP`, and `GOT`, spaces the jump and call operands, and closes
the printed string literals at lines 50, 56, and 60. It preserves the original
game logic, including `INT(LOG(L)/LOG(2))+1`, the use of `RND(0)` to choose
a number from 1 through the integer limit, and continued play after each win.

The [archived EDUSYSTEM-30 replay](guess-edusystem30-reference.json) verifies
a too-high clue, a too-low clue, wins under and at the computed benchmark,
and entering zero to return to the opening and change the limit.
A fresh RUN verifies the assessment after taking more guesses than the
benchmark. Both captures stop at the next waiting prompt. The stock
EDUSYSTEM-30 random stream starts from its default state on fresh RUN.
The EduSystem 20 sample uses a different sequence of target numbers.

In the [playground](https://basic-playground-rho.vercel.app/), choose
**GUESS · EDUSYSTEM-30 adaptation**. Try limit `100`, then guesses
`50`, `12`, and `23` for the archived opening. Enter `0` at a guess
prompt to choose another limit or use **Stop** to end the session.

```sh
python3 scripts/research/capture-edusystem30-guess.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/guess-edusystem30-reference.json
```
