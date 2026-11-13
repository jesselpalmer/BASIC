# SLOTS source review and EDUSYSTEM-30 replay

The [March 1975 printing, pages 198–199](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=198)
lists SLOTS without an author or original interpreter. The [pinned source](../scripts/package/fixtures/classic/slots.bas),
[reviewed print transcription](../scripts/package/fixtures/classic/slots-mar75-text.bas),
and [selected source](../scripts/package/fixtures/classic/slots-edusystem30.bas)
remain separate.

The transcription restores the dollar sign on reel 6, the trailing semicolon
on `TAB(28)`, the marked character constants `#Y` and `#N`, and the printed
reel comparison at line 430. The comparison determines whether a first pair of
equal even reels pays $5. It also restores the heading and payout text, and
line 270's out-of-range transfer to END. The runnable fixture joins the visibly
split `THE N` at line 220 to `THEN`. The pinned source reports `S1 560` twice
on stock EDU30.SV.

The [archive capture](slots-edusystem30-reference.json) matches all 21 printed
reel triples and running totals. Clock word 3289 is inferred by matching the
printed reel sequence against the archived generator's 4,096 possible clock
words. The stock simulator confirms that candidate, including both jackpot BEL
characters, the $26 ending total, and the farewell. A second RUN starts with
the same reel triple and $1 total. An invalid single-character reply consumes
no spin before the next `Y`.

Choose **SLOTS · EDUSYSTEM-30 MARK selected profile** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `Y` to spin again
and `N` to finish. The public example uses fresh host entropy on each RUN.

```sh
python3 scripts/research/capture-edusystem30-slots.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/slots-edusystem30-reference.json
```
