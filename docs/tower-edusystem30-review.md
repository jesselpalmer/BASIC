# TOWER source review and EDUSYSTEM-30 MARK adaptation

The March 1975 edition of _101 BASIC Computer Games_ credits Charles Lund of
The American School in The Hague, Netherlands, on [page 221][description].
The listing and sample on [page 222][listing] do not identify the interpreter.
The upstream README's BASIC-8 attribution remains unverified.

The [pinned transcription](../scripts/package/fixtures/classic/tower.bas) and
[reviewed March listing](../scripts/package/fixtures/classic/tower-mar75-text.bas)
are separate fixtures. The listing restores `E=0` at 120, `IF Q=S THEN 350`
at 250, labels 310 and 320 for the two-line invalid-size stop, `TO 7` at 800,
880, 930, 1030 and 1240, and `IF D<T(R,N) THEN 880` at 840. It also restores
printed wording and punctuation, including `WOULD BY` at 365. The prose on
page 221 describes two to seven disks. Line 250 in the listing admits one
through seven, and the reviewed source preserves that range.

Archived `EDU30.SV` reports eight `S1` diagnostics for the pinned source.
After the scan corrections, it still reports `S1 1160` and `S1 1170` at the
string comparisons in the replay code. The separate
[MARK adaptation](../scripts/package/fixtures/classic/tower-mark-adapted.bas)
changes only 1150–1180. It replaces the `YES` and `NO` string responses with
`INPUT $A` and the marked character constants `#Y` and `#N`. It keeps the
archive's accepted closing `PRINT` and `END` on the same numbered line.
Separate archive probes place `END` at the beginning, middle and end of the
highest line. Execution skips every statement after `END`, and the compiler
reports `EN 20` when the highest line has no `END`.

The [archive capture](tower-edusystem30-reference.json) follows all seven
moves in the printed three-disk solution, including the retry after `12`.
It checks invalid replay input, a three-move two-disk replay, and a fresh
RUN with the same two-disk output. A seven-disk run checks both rules
against moving larger disks illegally, and stops after the second invalid
needle. A separate run stops after the third invalid disk count. The
transcript hashes preserve the spacing of the TAB-drawn needles and disks,
and exclude the OS/8 banner and operator input echo.

In the [playground](https://basic-playground-rho.vercel.app/), choose
**TOWER · EDUSYSTEM-30 MARK adaptation**. Try `2` disks, then submit disk and
needle entries `13`, `2`, `15`, `3`, `13`, `3` in order. Use `Y` to replay or
`N` to finish. The library and CLI select `edusystem-30-mark` for this fixture.

```sh
python3 scripts/research/capture-edusystem30-tower.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/tower-edusystem30-reference.json
```

[description]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=221
[listing]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=222
