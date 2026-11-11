# EDUSYSTEM-30 PRINT comma evidence

On the pinned EDU30.SV tape, a PRINT comma advances to the next strictly
greater zero-based column from 14, 28, 42, and 56. At column 56 or later,
it emits one space followed by CRLF and resets the column to zero. Numeric
field sign and trailing spaces contribute to the current column.

Leading and consecutive commas each advance one zone. A trailing comma
advances immediately and suppresses the implicit end-of-statement newline.
The next PRINT or numeric INPUT prompt can then appear in that zone, as in
ROCKET's status rows. A comma that wraps at the last zone already emitted a
newline. `,;` and `;,` produce `S2` diagnostics in the archive.

The [raw capture](edusystem30-print-comma-reference.json) keeps CRLF, spaces,
and the interpreter's `NUL CRLF` epilogue. The public profile normalizes
the newline to LF and omits the epilogue. Input echo is outside this capture.

Reproduce the capture with the pinned simulator and tape described in the
[EDUSYSTEM-30 source review](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run).

```sh
python3 scripts/research/probe-edusystem30-print-comma.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
