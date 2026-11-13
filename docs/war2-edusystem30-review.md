# WAR-2 source review and EDUSYSTEM-30 adaptation

The [March 1975 printing, pages 232–233][book] credits Bob Dores and
shows a treaty, a loss after invalid troop allocations and an oversized
attack, and a win. The printed pages leave the interpreter unnamed.
The upstream inventory suggests EDUSYSTEM 30.

The [pinned source](../scripts/package/fixtures/classic/war2.bas) and
[reviewed transcription](../scripts/package/fixtures/classic/war2-mar75-text.bas)
are preserved separately. The review restores the commas after the initial
Navy and Air Force totals, the strict comparisons at 110, 215, 320 and 1045,
and the abbreviated keywords printed in the listing. Stock EDU30.SV rejects
the original and reviewed sources. Its diagnostics include `ST` on the
abbreviated statements and `S1` at both computed dispatches.

The [EDUSYSTEM-30 adaptation](../scripts/package/fixtures/classic/war2-edusystem30-adapted.bas)
spells out `PRINT`, `GOTO` and `THEN`. Each computed dispatch becomes
three numbered equality tests, preserving choices 1 through 3. The verified
path covers those choices, with out-of-range dispatch outside the comparison.
The [archive capture](war2-edusystem30-reference.json) replays all three
printed input sequences on the stock archive and records every output column
and numeric prompt. The installed library, CLI/editor and browser replay the
same sessions, including fresh starts between outcomes.

Choose **WAR-2 · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `30000`,
`20000` and `22000` at the first three prompts, then `1`, `2`, `1` and
`2.34` for the printed treaty.

```sh
python3 scripts/research/capture-edusystem30-war2.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/war2-edusystem30-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=232
