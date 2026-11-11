# ROCKET on EDUSYSTEM-30

The [March 1975 printing, pages 182–184](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=184)
credits Jim Storer for the original FOCAL program. The printed BASIC listing
and sample run both say `EDUSYSTEM 30`. The [pinned transcription](../scripts/package/fixtures/classic/rocket.bas)
has SHA-256 `401d6665afacbccb1a4486607bce33ad2e023522534e8bdffc63d9321e96d38c`.
The [reviewed fixture](../scripts/package/fixtures/classic/rocket-mar75-text.bas)
restores printed literals, the trailing comma on line 21, the separate scalar
assignments on line 61, the square-root expressions on lines 71 and 81, and
the power-series expressions on lines 91 and 94. Its SHA-256 is
`25afb43125155c40d632de746101bae10516eb5e1e2452c65762ea8001dc2193`.

## Archived execution

The [archived EDU30.SV transcripts](rocket-edusystem30-reference.json) record
the sample landing and a separate fresh RUN with zero burn. The sample
reproduces all 24 printed status rows and lands at `233.183` seconds with an
impact velocity of `1.6042` mph. The zero-burn run crashes. Both branches
print the restart message and automatically return to the first burn-rate
prompt with the initial capsule state. The transcripts exclude typed answers,
the OS/8 banner and the operator interruption. The archive prints comma
columns at 14-character intervals, including the space before the input
prompt after the trailing comma.

The library, portable CLI/editor and browser replay both captures through the
selected profile. Choose **ROCKET · EDUSYSTEM-30 selected profile** in the
[playground](https://basic-playground-rho.vercel.app/) and enter a burn rate
from 0 to 200 at each prompt. The [capture](rocket-edusystem30-reference.json)
lists the exact burn sequence for the printed landing.

```sh
python3 scripts/research/capture-edusystem30-rocket.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/rocket-edusystem30-reference.json
diff -u <(python3 -m json.tool docs/rocket-edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/rocket-edusystem30-reference.json)
```
