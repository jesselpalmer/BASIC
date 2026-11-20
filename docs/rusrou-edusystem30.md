# RUSROU on EDUSYSTEM-30

The [March 1975 description and listing, page 192][book] credit Tom Adametx
of Curtis Junior High School in Sudbury, Massachusetts. It also names John
Kowalik as the author of a different submission. The printed interpreter
remains unverified.

The [pinned corpus transcription](../scripts/package/fixtures/classic/rusrou.bas)
preserves the [upstream bytes][upstream]. The
[EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/rusrou-edusystem30.bas)
restores the missing decimal point in line 40. The scan reads
`IF RND(0)>0.83333 THEN 70`, while the corpus reads `RND(0)>83333`.
The adaptation retains the corpus's title and prompt spacing, including its
colon after GO, and adds a terminal newline. The printed GO prompt has no
colon. The description says that ten surviving turns win, while the listing
checks `N>10` after the random loss test. The adaptation preserves that check,
so a win requires eleven surviving pulls.

The [stock EDU30.SV capture](rusrou-edusystem30-reference.json) covers ten
clicks, an eleventh surviving pull and the win message, an immediate loss in
the next round, giving up, and a fresh run with a different clock word.
The game continuously starts another round. The library and direct CLI
checks consume the archived answers and then report `INPUT_ENDED` at line 30.
The editor check saves and reloads the source document, interrupts at the
next prompt, and replays it from a fresh RUN. The browser checks every prompt,
output, Stop and fresh RUN against the same archive capture.

Choose **RUSROU · EDUSYSTEM-30 adaptation** in the
[playground][playground]. Enter `1` at each turn or `2` to give up the round.
Use **Stop** to leave the session.

```sh
python3 scripts/research/capture-edusystem30-rusrou.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/rusrou-edusystem30-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=192
[upstream]: https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/rusrou.bas
[playground]: https://basic-playground-rho.vercel.app/
