# EDUSYSTEM-30 numeric PRINT evidence

The [capture](edusystem30-print-reference.json) records archived `EDU30.SV`
output with the same SIMH commit and tape as the [CHANGE
review](change-edusystem30-review.md). The scalar probe prints each value and
its negation between literal markers, then snapshots the three stored words
while another INPUT waits. The separate receipt probe covers text before and
after a numeric expression, a trailing semicolon, and adjacent numeric fields.
The arithmetic probe prints both operands and their difference for the same
original 57 input pairs in the [arithmetic capture](edusystem30-arithmetic-reference.json).
All captures remove input echo, CR and terminal NUL padding while retaining
the PRINT fields' spaces and line breaks. The table uses `␠` for a space.

| Stored input or expression | Numeric field content |
| -------------------------- | --------------------- |
| `0` or `-0`                | `␠0␠`                 |
| `-2`                       | `-2␠`                 |
| `.5`                       | `␠.5␠`                |
| `0.12`                     | `␠1.2E-1␠`            |
| `.1249999`                 | `␠.125␠`              |
| `1.234568`                 | `␠1.23456␠`           |
| `1.234569`                 | `␠1.23457␠`           |
| `999999.25`                | `␠1000000␠`           |
| `1048575.75`               | `␠1.04857E6␠`         |
| `10-4.59`                  | `␠5.41␠`              |

The instruction trace starts numeric PRINT at octal `03400`. The evaluation
at `03402` multiplies the value by the literal at `03123–03125`
(`0001,2000,0004`, or exactly 1 + 2⁻²⁰). The mode check at
`03422–03427` selects fixed form for a resulting binary exponent from
−2 through 20. This accounts for the change of notation around ⅛ and 2²⁰,
including values that cross either boundary after multiplication.

To repeat the instruction trace, enter `10 INPUT A`, `20 PRINT A;`,
`30 INPUT W` and `40 END` and run the listing. At the first question mark,
use Ctrl+E to enter SIMH, set `set cpu history=65536` and `break 01056[11]`,
then continue and enter `1.234569`. The breakpoint stops at the terminal
buffer routine before the numeric field's sign. Continue once more to stop
at the first digit. `show cpu history=10000` includes the multiply and the
fixed-form decision.

The [checker](../scripts/research/check-edusystem30-print.py) decodes the
stored words and applies the traced multiplication at the stored precision.
For each fractional digit, it multiplies the remainder by ten at that
precision, emits the integer part and subtracts it. The check at octal
`03562–03573` stops when the remainder is zero or its binary exponent is
at most three times the number of digits already printed minus 18. It
counts integer digits but excludes the sign and decimal point. This allows
up to six significant digits and retains all fixed-form integer digits.

The [remainder probe](edusystem30-print-remainder-reference.json) captures both
operands, the stored difference and the exact field for 12 more receipts.
For cost `14.69` and payment `14.82`, EDU30 stores
`0.130001068115234375` but stops after printing `.13`. For `46.33` and
`46.74`, the intermediate stored precision yields `.410003`. A decimal
truncation of the adjusted value alone would print `.130001` and `.410004`.

Fixed fractions omit the leading zero. The scientific path at octal
`03430–03457` estimates decimal scale from the adjusted binary exponent `E`
with the stored approximation of log₁₀(2), octal `2321` divided by 4096.
For a negative `E` it takes the floor of `(1-E) × 1233/4096`. For a
nonnegative `E` it takes `-floor(E × 1233/4096) - 1`. The archived
scaling applies powers of ten in groups of eight and then single powers.
It multiplies by ten and increments the scale while the result's binary
exponent is nonpositive. The printed decimal exponent is the negated final
scale. This produces `9.99999E8` from `0.999999E9`, whose coefficient crosses
the decade boundary under a different scaling order. Scientific fields use
uppercase `E` with a minus sign for negative exponents. Every nonnegative
field starts with a space and every field ends with a space.

The checked evidence covers the captured output range. Error behavior at the
full signed-exponent limits remains open.

```sh
python3 scripts/research/capture-edusystem30-print.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-print-reference.json
diff -u <(python3 -m json.tool docs/edusystem30-print-reference.json) \
  <(python3 -m json.tool /tmp/edusystem30-print-reference.json)
python3 scripts/research/capture-edusystem30-print.py --remainder \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-print-remainder-reference.json
diff -u <(python3 -m json.tool docs/edusystem30-print-remainder-reference.json) \
  <(python3 -m json.tool /tmp/edusystem30-print-remainder-reference.json)
python3 scripts/research/check-edusystem30-print.py
```
