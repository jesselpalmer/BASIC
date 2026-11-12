# CHOMP on archived EDUSYSTEM-30

The [March 1975 printing, pages 78–79](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=78)
credits Peter Sessions of People's Computer Company. The page leaves the
original BASIC interpreter unspecified.

The [pinned transcription](../scripts/package/fixtures/classic/chomp.bas)
has SHA-256 `03500272496fb39a1aacc0137c44000f08804698d43a0387cb16265b6ac27a55`.
The [reviewed listing](../scripts/package/fixtures/classic/chomp-mar75-text.bas)
has SHA-256 `6749ee5fe345ce8a54c87b8618e65b1d6533d58da75b106cd3244a54c8a33330`.
It restores printed punctuation, prompt markers and trailing spaces. The
control flow and game rules are the same in both listings.

## Archived playthroughs

The [archive capture](chomp-edusystem30-reference.json) runs the printed
two-player game on a 4-by-7 cookie. It verifies the rules demonstration,
board positions after every move, the rejected empty square and Player 2's
loss on the poison square. In the same RUN, a 1-by-1 replay ends with
Player 1's loss. A separate fresh RUN checks rejected dimensions, an
out-of-bounds move and rotation through three players.

Choose **CHOMP** in the [playground](https://basic-playground-rho.vercel.app/).
Enter the player count, row count and column count. Players take turns
entering a row and column separated by a comma. The upper-left square at
`1,1` ends the game.

```sh
python3 scripts/research/capture-edusystem30-chomp.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/chomp-edusystem30-reference.json
```
