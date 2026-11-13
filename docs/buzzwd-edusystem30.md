# BUZZWD source review and EDUSYSTEM-30 adaptation

The [March 1975 printing, pages 63–64](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=63)
credits Tom Kloos for adapting the GE timesharing program. The printed
sample identifies EDUSYSTEM-35.

The [pinned source](../scripts/package/fixtures/classic/buzzwd.bas) and
[reviewed transcription](../scripts/package/fixtures/classic/buzzwd-mar75-text.bas)
are retained separately. The printed listing labels the last instruction
line 191 and starts `SYSTEMATIZED` with no leading space, both of which
differ in the corpus. The word lists use semicolons to keep the three
words on a single line. The printed listing and corpus both jump to
1080, but label the corresponding `CAPABILITY` statement 1082. The
reviewed transcription fails stock EDU30.SV compilation with `UL 1080`.

The [standalone adaptation](../scripts/package/fixtures/classic/buzzwd-edusystem30.bas)
renumbers 1082 to 1080, adds keyword spacing outside strings and omits
the terminal `CHAIN "DEMON "` after the farewell. The book's sample ends
at the farewell. The program's original end-of-session handoff and an
EDUSYSTEM-35 replay remain open.

The [archive capture](buzzwd-edusystem30-reference.json) verifies all
eight printed phrases and the farewell. A fresh RUN checks a triple
split across two replies, a bad field followed by retyping the two
remaining fields, the repaired `CAPABILITY` branch, and the range retry.

Choose **BUZZWD · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Try `1,2,3` for
`TOTAL MONITORED MOBILITY`. Enter `100,100,100` to finish.

```sh
python3 scripts/research/capture-edusystem30-buzzwd.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/buzzwd-edusystem30-reference.json
```
