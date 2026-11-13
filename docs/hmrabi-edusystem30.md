# HMRABI on EDUSYSTEM-30

The [March 1975 printing, pages 128–129][book] identifies David Ahl's
conversion of the FOCAL game to EDUSYSTEM 70. The
[pinned transcription](../scripts/package/fixtures/classic/hmrabi.bas)
preserves the [upstream bytes][upstream].

The [EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/hmrabi-edusystem30.bas)
restores the printed opening labels 20, 80 and 85, the plague calculation
at 228, the harvest variable at 235 and the year-limit IF at 270. It restores
the buy and sell branches at 334 and 344, the grain and labor tests at 450–455,
the starvation count at 560 and the blank line before refusal at 850.
The adaptation spells statement separators with backslashes, including the
farewell loop at 990, and supplies an argument to RND at 965 for EDUSYSTEM-30.

The [archived EDU30.SV transcripts](hmrabi-edusystem30-reference.json) cover
a complete ten-year term and a fresh run that ends in impeachment. The first
run exercises purchase, sale, grain and labor retries, reports plague,
completes with zero deaths from starvation and prints the highest
performance assessment. The second run feeds half the population and prints
the one-year impeachment. Both end with ten BEL characters and the farewell.
The same transcripts are checked through the installed library, CLI/editor
and browser with the recorded RANDOMIZE clock words.

Select **HMRABI · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Follow the prompts
to buy or sell land, feed the population and plant acres. Enter a negative
number to give up the term.

```sh
python3 scripts/research/capture-edusystem30-hmrabi.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/hmrabi-edusystem30-reference.json
```

The replay identifies the behavior of the adaptation on the archived
EDUSYSTEM-30 interpreter. The original EDUSYSTEM 70 run remains unverified.

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=128
[upstream]: https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/hmrabi.bas
