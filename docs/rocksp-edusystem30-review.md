# ROCKSP source review and EDUSYSTEM-30 adaptation

The March 1975 book credits Charles Lund of The American School in The Hague
on [printed page 188](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=188).
The listing header shows 03-MAY-73 and leaves the interpreter unnamed.

The [reviewed transcription](../scripts/package/fixtures/classic/rocksp-mar75-text.bas)
restores `Q<11`, the printed ten-game maximum, instead of the pinned corpus
copy's `Q<1`. It also restores label 185, final score punctuation and the
printed `SISSORS` spelling. Archived EDU30.SV rejects both the
[pinned copy](../scripts/package/fixtures/classic/rocksp.bas) and the reviewed
transcription.

The separate [EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/rocksp-edusystem30.bas)
replaces prompted INPUT with a joined PRINT and unprompted INPUT. It passes a
dummy argument to RND and expands ON GOTO and the inline IF branches to
numeric tests and literal jumps. It keeps the printed outcome logic and
score calculation.

Clock word 3720 uniquely matches the eight computer choices visible in the
sample when tested against all 4,096 archived seed words. The
[archived reconstruction](rocksp-edusystem30-reference.json) fills in the
partly obscured player moves in rounds four, six and seven. These moves
are a reconstruction. The listed code awards round five to the player
when paper meets rock, while the surviving sample text begins the
computer's win message. The reconstruction ends 4–4–2, compared with
the printed sample's 5–3–2. A fresh three-round run checks an invalid move retry,
a tie, a computer win and a player win.

In the [playground](https://basic-playground-rho.vercel.app/), choose
**ROCKSP · EDUSYSTEM-30 adaptation**. Enter the number of rounds, then use
`1` for paper, `2` for scissors, and `3` for rock.

```sh
python3 scripts/research/capture-edusystem30-rocksp.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/rocksp-edusystem30-reference.json
```
