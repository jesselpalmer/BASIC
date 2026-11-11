# EDUSYSTEM-30 numeric PRINT evidence

The [capture](edusystem30-print-reference.json) records archived `EDU30.SV`
output with the same SIMH commit and tape as the [CHANGE
review](change-edusystem30-review.md). The scalar probe prints each value and
its negation between literal markers, then snapshots the three stored words
while another INPUT waits. The separate receipt probe covers text before and
after a numeric expression, a trailing semicolon, and adjacent numeric fields.
The arithmetic probe prints both operands and their difference for the same
57 input pairs as the [arithmetic capture](edusystem30-arithmetic-reference.json).
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
buffer routine before the numeric field's sign. `show cpu history=10000`
includes the multiply and the fixed-form decision.

The [checker](../scripts/research/check-edusystem30-print.py) decodes the
stored words, applies the traced multiplication at the stored precision,
and truncates the adjusted decimal digits. It uses up to six significant
digits, retains all fixed-form integer digits, and drops trailing fractional
zeros. Fixed fractions omit the leading zero. Scientific fields use uppercase
`E` with a minus sign for negative exponents. Every nonnegative field starts
with a space and every field ends with a space.

This checks the captured output range and does not establish full terminal
conformance. In particular, the archive scales scientific values with PDP-8
arithmetic and tests the remaining fractional magnitude before each digit.
The checker uses exact decimal expansion and does not model those internal
operations across the full exponent range. This evidence does not enable
numeric PRINT expressions in the public profile.

```sh
python3 scripts/research/capture-edusystem30-print.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-print-reference.json
diff -u <(python3 -m json.tool docs/edusystem30-print-reference.json) \
  <(python3 -m json.tool /tmp/edusystem30-print-reference.json)
python3 scripts/research/check-edusystem30-print.py /tmp/edusystem30-print-reference.json
```
