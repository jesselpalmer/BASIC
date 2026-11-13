# CHIEF source review and EDUSYSTEM-30 MARK adaptation

The [March 1975 printing, page 77][book] credits John Graham and describes
arithmetic practice through a number trick. The page leaves the original
interpreter unspecified. The opening and a response retain the period
listing's stereotyped depiction of Indigenous people.

The [pinned source](../scripts/package/fixtures/classic/chief.bas) and
[reviewed transcription](../scripts/package/fixtures/classic/chief-mar75-text.bas)
are preserved separately. The review restores printed string spacing and
punctuation, including the comma after the result at line 230 and the three
spaces between the two Xs at 370. It keeps the printed arithmetic formula,
the `TAB` adjacency, and the descending loop bounds. The stock EDU30.SV
compiler reports `S1 40`, `S1 130` and `S1 290` for the string comparisons
in both sources.

The [MARK adaptation](../scripts/package/fixtures/classic/chief-mark-adapted.bas)
uses one-character replies through `INPUT $` and tests for marked `#Y` in
place of the three `YES` comparisons. The other response path remains the
same. It adds the question marks and line breaks that follow the original
string prompts in the printed sample.

The [archive capture](chief-edusystem30-reference.json) verifies the printed
`3.8` response, `-3.625` guess, and the worked explanation for the original
number `12`, including the final result of `8.8`. It matches all 23 lightning
rows and the closing line. Two fresh runs verify agreeing with the first guess
and agreeing after the explanation, both of which end at the existing farewell.

Choose **CHIEF · EDUSYSTEM-30 MARK adaptation** in the
[playground](https://basic-playground-rho.vercel.app/). Enter `N`, `3.8`,
`N`, `12` and `N` for the sample arithmetic and lightning bolt.

```sh
python3 scripts/research/capture-edusystem30-chief.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/chief-edusystem30-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=77
