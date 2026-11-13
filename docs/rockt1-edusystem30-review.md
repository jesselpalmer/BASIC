# ROCKT1 source review and EDUSYSTEM-30 MARK adaptation

The March 1975 book credits Eric Peters of Digital Equipment Corporation
on [printed page 183][credit]. The [listing and sample on page 185][listing]
are dated May 8, 1973. The page gives no system banner. The upstream
BASIC-8 attribution remains unverified.

The [pinned source](../scripts/package/fixtures/classic/rockt1.bas) and
[reviewed transcription](../scripts/package/fixtures/classic/rockt1-mar75-text.bas)
preserve distinct versions. The transcription restores the half-second
averaging factor `.5` in line 570, the missing quote in line 880,
and the printed plot marker, headings, and blank lines. Stock
EDU30.SV reports `UQ 880` for the pinned source. Both versions also
report `PC 100` and `S1` at lines 120, 520, 530 and 870.

The separate [MARK adaptation](../scripts/package/fixtures/classic/rockt1-mark-adapted.bas)
replaces the two string responses with one-letter `Y` and `N`. It
recasts the inline assignments at 520 and 530 as line-target branches
followed by assignments to retain the thrust and remaining-fuel clamps.
All flight and touchdown calculations retain the reviewed source.

The [archive capture](rockt1-edusystem30-reference.json) runs the book's
two burn sequences. The first uses all the fuel and crashes after 18.6475
seconds at 23.2379 feet per second. The printed sample reports 18.6476
seconds and the same impact speed. The replay reaches the printed
perfect landing at 11 seconds with zero velocity and 15 fuel units
remaining. A fresh RUN skips instructions and submits 40 for the final
burn. The clamp to 30 produces the same perfect landing. The capture
retains the backward-TAB terminal bytes and records a separate digest
for the corresponding browser paper columns.

Choose **ROCKT1 · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `Y` for
instructions or `N` to start. Enter a fuel burn from 0 to 30 at each
prompt. To try the printed landing, enter `5` nine times and then
`30` twice. Enter `Y` to replay or `N` to finish.

```sh
python3 scripts/research/capture-edusystem30-rockt1.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/rockt1-edusystem30-reference.json
```

[credit]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=183
[listing]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=185
