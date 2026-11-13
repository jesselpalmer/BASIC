# EVEN1 source review and EDUSYSTEM-30 MARK adaptation

The [March 1975 printing, pages 96 and 98][book] describes EVEN1 as the
cybernetic version of EVEN. It starts with a table of four-chip moves and
changes its table after player wins. The page 98 sample gives the program name
and a timestamp of 5:54 p.m. on 29 June 1973. The interpreter is unspecified.

The [pinned corpus](../scripts/package/fixtures/classic/even1.bas) and
[reviewed transcription](../scripts/package/fixtures/classic/even1-mar75-text.bas)
are separate fixtures. The review restores `L1=L` at 130, the `>=` and `<=`
comparisons at 160 and 180, the branch to 450 on a move below one, and the
decrement of `R(E1,L1)` at 490. It preserves printed label 390 and the literal
branch target 19 on the no-instructions path. There is no line 19. Stock
EDU30.SV rejects both sources, including the colon separators, the opening
prompted string INPUT and comparison, and bare `RND`.

The [MARK adaptation](../scripts/package/fixtures/classic/even1-mark-adapted.bas)
uses backslash statement separators and `RND(0)`. It changes the opening to a
one-character response using `INPUT $A`, with `N` jumping to the first
initialization line at 20. Other responses show the instructions, consistent
with the printed string comparison's fallthrough.

The [archived transcripts](even1-edusystem30-reference.json) use clock word 1744.
One run reproduces the first six printed rounds, adds a retry for an illegal
move, and quits during the seventh round. The clock word was chosen for this
prefix. The book's complete random stream and original seed remain unverified.
A fresh RUN with the same clock word skips the instructions, records a computer
win, and quits. With the same 21-chip opening, the computer takes two chips
after the earlier player win and four in the fresh run after the computer win.
The full transcripts include the printed board sizes and take counts, numeric
INPUT prompts and endings. They exclude operator echo and OS/8 framing.

Choose **EVEN1 · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `Y` for
instructions or `N` to start immediately. Take one to four chips each turn.
Aim to hold an even total when the pile is empty. Enter `0` to quit.

```sh
python3 scripts/research/capture-edusystem30-even1.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/even1-edusystem30-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=98
