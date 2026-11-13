# 3DPLOT source review and EDUSYSTEM-30 evidence

The March 1975 edition of _101 BASIC Computer Games_ credits Mark Bramhall
of Digital Equipment Corporation on [page 216](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=216).
The executable tokens of the [pinned 3DPLOT listing](../scripts/package/fixtures/classic/3dplot.bas)
match the printed listing. The pinned transcription normalizes whitespace
and ends immediately after the last statement. The printed listing and the
sample on [page 217](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=217)
leave the original BASIC interpreter unspecified. The two printed sample runs
replace the listing's function with cosine variants.

## 3DPLOT on archived EDUSYSTEM-30

The unmodified pinned listing completes on the archived EDU30.SV interpreter.
Two RUNs produced identical output with an initial blank line and 41 symmetric
rows of asterisks. The [capture](3dplot-edusystem30-reference.json) records
the rows and a digest with banner, terminal input echo, and READY framing
removed. Horizontal plot spacing remains significant. Choose **3DPLOT · EDUSYSTEM-30
selected profile** in the [playground](https://basic-playground-rho.vercel.app/)
and select Run to draw the base plot. The program ends after the last row.

The archive probes establish that numbered unary `DEF FN` definitions bind
before execution, with the highest numbered definition winning when a name is
defined twice. A call evaluates its argument before binding the formal. The
formal shadows its scalar through nested function calls and restores the
caller's value on return. The archive reports `ERROR SP AT LINE 0020` when the
sample recursive definition exhausts the interpreter stack. The selected profile
reports a located runtime diagnostic at the calling expression for recursive
calls. It also bounds function evaluation to 4,096 calls per expression.

```sh
python3 scripts/research/capture-edusystem30-3dplot.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/3dplot-edusystem30-reference.json
```
