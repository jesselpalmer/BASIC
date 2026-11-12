# BOUNCE source review and EDUSYSTEM-30 evidence

The March 1975 edition of _101 BASIC Computer Games_ identifies Val
Skalabrin as the author on [page 47](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=47).
The printed listing and sample are headed `BOUNCE EDUSYSTEM 30`.

The [pinned listing](../scripts/package/fixtures/classic/bounce.bas) has
SHA-256 `a5010e3085220dfef1cf9d19c6c4a520c382c5e53df5d2076b11b3ad92c1b672`.
The [reviewed listing](../scripts/package/fixtures/classic/bounce-mar75-text.bas)
has SHA-256 `1d7c5e33c49274161ad71fd56f5bae691a66da3b6bf3e324968b5d305b88ce49`.
Two scan-backed changes restore the comma after `STRAIGHT UP` at line 110
and relabel the time-increment prompt from 125 to 135. The archived interpreter
reports `UL 135` before executing the pinned listing because line 430 targets
that missing label.

The reviewed text plots the ball across the terminal. The printed run takes
`.1` seconds, `30` feet per second and a coefficient of `.9`. It prints
height labels 14 through 0 and a time axis from 0 to 6 seconds. The plot
includes significant carriage return and NUL bytes where TAB moves backward.
A second simulation with `.2`, `24` and `.6` prints height labels 9
through 0 and a time axis from 0 to 5. The alternate plot is identical on
replay and on a fresh RUN. Each plot returns to the time-increment prompt.

The [archived transcript digests](bounce-edusystem30-reference.json) exclude
terminal input echo, the OS/8 banner and the operator's final interrupt.
They preserve horizontal spacing and backward TAB control bytes.
The playground renders those returns as overprinting on the same row,
so a space after the return advances without erasing an existing mark. Run the
reviewed source with `edusystem-30` or choose **BOUNCE · EDUSYSTEM-30
selected profile** in the [playground](https://basic-playground-rho.vercel.app/).

```sh
python3 scripts/research/capture-edusystem30-bounce.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/bounce-edusystem30-reference.json
```
