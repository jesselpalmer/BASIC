# AMAZIN source review and EDUSYSTEM-30 adaptation

The [March 1975 printing, pages 15–16](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=15)
credits Jack Hauber. The listing and sample identify EDUSYSTEM 30. The book
advises changing the DIM bounds at line 110 to fit the available memory.

The [pinned corpus source](../scripts/package/fixtures/classic/amazin.bas)
has SHA-256 `bb31020296c2d58888623373ad5da26d2095c6fa60aa4d733df3bd73ad`.
The [reviewed transcription](../scripts/package/fixtures/classic/amazin-mar75-text.bas)
restores the comma in the dimensions retry, the label 323, the equality
test at line 390, and the completion tests at 842, 900 and 951. It keeps
the printed `DIM W(25,103),V(25,103)`. Both sources report `M1 1073` on
stock EDU30.SV before the first prompt.

The separately labeled
[EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/amazin-edu30-adapted.bas)
sets both DIM bounds to `(9,7)`, the dimensions of the maze in the printed
sample. The source retains the printed algorithm and prompts. The
[archive capture](amazin-edusystem30-reference.json) records a `1,1`
retry followed by a complete 9×7 maze at clock word 2, and a fresh 5×4
maze at clock word 113. The archive script verifies each grid's wall
columns, a single entrance and exit, and a connected graph with one fewer
passage than cells. The book's sample clock word remains unverified. A separate 9×7 archive
run at clock word 0 leaves one isolated interior cell.

Choose **AMAZIN · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter integer dimensions from 2–9 wide and 2–7 long at the prompt.
Try `9,7` or `5,4` and select Run again for a new maze. In the selected
profile, `10,7` and `9,8` report an array bounds diagnostic.

```sh
python3 scripts/research/capture-edusystem30-amazin.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/amazin-edusystem30-reference.json
```
