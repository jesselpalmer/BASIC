# EDUSYSTEM-30 compiled numeric literals

The compiler reads the digits of a source literal into a 35-bit magnitude.
It normalizes the integer magnitude to 23 stored bits and scales it by the
explicit exponent minus the number of fractional digits. The [archived
capture](edusystem30-literal-reference.json) records 30 stored results and
the `LI` diagnostic for four spellings that overflow the digit accumulator.

The decimal scale tables at octal `03137–03174` and `01335–01372` store
a signed binary exponent and two unsigned mantissa words per entry. The
compiler walks the scale bits from lowest to highest, multiplying by a table
entry for each set bit. It discards the low 24 product bits before normalizing.
For example, the compiled literal `1.8` stores `0001 3463 1462`, while
entering `1.8` at INPUT stores `0001 3463 1463`. Selected arithmetic and
comparisons preserve that difference.

The shared tokenizer limits source tokens to finite JavaScript numbers.
The selected compiler conversion also checks the archive table and binary
exponent ranges. Unary signs remain expression operators.

```sh
python3 scripts/research/probe-edusystem30-source-literals.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-literal-reference.json
```
