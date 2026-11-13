# NIM on EDUSYSTEM-30 MARK

The [March 1975 description and listing, pages 160–161][book] credit Robert G.
Cox of Trinity College. The description names DIGITAL EduSystem 10 for a
different submission by Larry Ruane. The interpreter for the printed Cox
listing remains unverified.

The [pinned corpus source](../scripts/package/fixtures/classic/nim.bas) retains
the upstream bytes. The [MARK adaptation](../scripts/package/fixtures/classic/nim-edusystem30.bas)
restores the separator before INPUT at 130 and removes the stray period from
label 425. It restores the even-parity test `V(Y)/2-INT(V(Y)/2)=0` at 455 and
the singular-move test `D=1` at 540. Each of these changes follows the printed
listing. At the decision prompts it reads one marked character and compares
it to `#Y` or `#N`. It adds question marks and line breaks to those prompts.

The [archived EDU30.SV replay](nim-edusystem30-reference.json) includes illegal
pile and stick counts, a two-stick computer win, replay with the same
arrangement, and a player win. A fresh two-pile game with the computer moving
first exercises the single-stick move and the pile table before a second
computer win. Both runs end at the listing's STOP. The installed library,
CLI/editor, and browser match those captured outputs.

Choose **NIM · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Use `Y` or `N` at
decision prompts. Enter the number of piles and the size of each pile, then
pick a pile and how many sticks to take. Whoever takes the last stick wins.

```sh
python3 scripts/research/capture-edusystem30-nim.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/nim-edusystem30-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=160
