# SYNONM source review

The March 1975 description and listing, pages [212–213][book], credit Walt
Koetke of Lexington High School, Massachusetts. The listing explicitly identifies
Dave Ahl's conversion to RSTS/E BASIC-PLUS. The author's earlier interpreter
and the printed sample's random sequence remain unverified.

The [pinned fixture](../scripts/package/fixtures/classic/synonm.bas) preserves
upstream bytes. The [reviewed listing](../scripts/package/fixtures/classic/synonm-mar75-text.bas)
restores the period after MEANING at 110 and the comma after SYNONYM at 140.
The word sets, random draws, HELP table and responses retain the printed source.

The [public adaptation](../scripts/package/fixtures/classic/synonm-ma2.bas)
expands the assignment modifier at 232 into an ordinary FOR/assignment/NEXT
at 231–233. Its final STOP becomes END at 420. The archived comparison treats
STOP's monitor diagnostic separately from program output. These adaptations
avoid requiring general assignment modifiers or historical STOP diagnostics.

## Complete archived drill

The [reference](synonm-rsts-reference.json) compares the reviewed and adapted
listings on reconstructed RSTS V4A-12 MA2 and archived V04B-17. All four runs
match through the ten-word completion. RANDOMIZE is omitted only during
archive capture to use the stock initial stream; the public fixture retains it,
and acceptance supplies a zero entropy word.

The session submits an incorrect answer and requests two different HELP hints
before answering correctly. It then answers all ten randomly selected word
sets, without repeating a set. The complete output includes the selected
praise and the final SYNONYM DRILL COMPLETED message. Fresh RUN clears the
used-word table, DATA cursor and string arrays and repeats the archived drill.
This establishes a selected adaptation, rather than certification of the raw
listing on its original interpreter.

## Play SYNONM

Choose **SYNONM · BASIC-PLUS adaptation** in the [playground][playground].
Type an uppercase synonym or HELP. Complete ten questions to finish the drill.
The library, installed CLI/editor and browser verify the archived session;
the editor also saves/reloads the exact selected document and runs it twice.

```sh
python3 scripts/research/capture-synonm-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/synonm-rsts-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=212
[playground]: https://basic-playground-rho.vercel.app/
