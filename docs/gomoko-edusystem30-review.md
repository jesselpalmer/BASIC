# GOMOKO on EDUSYSTEM-30

The March 1975 [description and listing on printed pages 111–112](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=111)
credit Peter Sessions at People's Computer Company. The pages give no
interpreter identification. The description says the program dimensions
a 19×19 board at line 120. The listing has a size error message at line
120 and contains no DIM.

The [pinned transcription](../scripts/package/fixtures/classic/gomoko.bas)
has SHA-256
`d935a714e8df553a8faf9c2ee54467759cfb15cc5dac9aff3bba5610cc10c072`.
The [reviewed listing](../scripts/package/fixtures/classic/gomoko-mar75-text.bas)
restores the quoted quit coordinates, tests for an empty square at line 410,
uses the printed random Y expression at line 610, restores line 660 and
its board-print subroutine call, sends an illegal tactical move to the
random fallback at line 750, and restores the closing message punctuation.
The archived EDU30.SV compiler reports `S2` at each rank-two board reference
in both listings.

## Archived adaptation

The [EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/gomoko-edusystem30-adapted.bas)
adds only `100 DIM A(19,19)` to the reviewed listing. It uses the board
bound stated in the description. The [reference capture](gomoko-edusystem30-reference.json)
records both compiler rejections and three completed runs of the adaptation:

- The printed 8×8 input sequence draws nine boards, rejects the repeated
  `4,5` move, and ends after the player completes five in a row. Computer
  markers differ from the printed example. The archive's default random
  stream places the first computer marker at `2,1`, while the sample
  prints it at `7,1`.
- Size retries at 6 and 20, an illegal move, and an occupied square
  precede replay at size 7. Replay retains the board, so the repeated
  move at `4,4` is still rejected.
- The largest allowed board draws 19 rows and accepts `19,19`. A fresh
  RUN starts from an empty board and the default random state.

The program draws the board after successful turns and leaves detection
of a winning row to the player. Enter `-1,-1` to end the round. The
printed random fallback searches only column 1. If that column fills,
the computer can keep searching. At size 7, entering `1,1`, `3,1`,
`4,1`, and `7,1` reproduces the stall in both runtimes. The archived
interpreter produced no further output during a six-second wait, then
hit the `RND` entry breakpoint at octal `03532` after continuing. The
selected runtime reached its instruction limit during the search.
Use Stop and Run to start fresh in the playground.

The archived output excludes terminal input echo, the OS/8 banner,
simulator tape notices, and the transition to `READY`. Choose
**GOMOKO · EDUSYSTEM-30 adaptation** in the
[browser playground](https://basic-playground-rho.vercel.app/) or use
the `edusystem-30` profile in the library or portable CLI.

```sh
python3 scripts/research/capture-edusystem30-gomoko.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/gomoko-edusystem30-reference.json
```
