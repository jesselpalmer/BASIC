# CHANGE source and archive review

The [March 1975 printing, page 72](https://bitsavers.trailing-edge.com/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=72)
credits Dennis Lunder and shows the listing beside three example sales. The
greeting names EDUSYSTEM without a model number. The `EDU30.SV` archive run
establishes that this build executes the reviewed listing. The original
interpreter version remains open.

The [pinned raw source](../scripts/package/fixtures/classic/change.bas) has
26 physical lines and SHA-256
`658c2681bf1ca9afa4d57a263e6758165ba390d561f76ee6a92fd53e915e1b13`.
It matches the [pinned upstream file](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/change.bas).
The [reviewed source](../scripts/package/fixtures/classic/change-mar75-text.bas)
has SHA-256 `94983e92c1363ef39d6e23a10cc287ed316f5fbd6a28a643ecb880798cc46a95`.
The review restores both prompt semicolons at 10, the output semicolons at
90 and 120, comma spacing at 20, 90, 120 and 380, and the hyphen at 250.

Two fresh [archived captures](change-edusystem30-reference.json) agree. The
first three sales reproduce the printed change and denomination counts.
The archive also verifies equal payment, a shortage, change with every
denomination, and return to the next cost prompt. The capture excludes
input echo and the OS/8 run banner.

| Cost  | Payment | Change | Printed denominations                                              |
| ----- | ------- | ------ | ------------------------------------------------------------------ |
| 4.59  | 10      | 5.41   | Five-dollar bill, quarter, dime, nickel, penny                     |
| 0.17  | 5.00    | 4.83   | Four one-dollar bills, half-dollar, quarter, nickel, three pennies |
| 18.88 | 20      | 1.12   | One-dollar bill, dime, two pennies                                 |

## Numeric compatibility blockers

The public profile still requires numeric expressions in PRINT and
source-backed decimal conversion, arithmetic and formatting before this
listing can be enabled. The archive prints `.5` for both a cost of 0.01
paid with 0.51 and a cost of 0.51 paid with 1.01. The first sale returns a
half-dollar. The second returns a quarter, two dimes and five pennies. At
a nominal one dollar of change, the archive reports these paths.

| Cost | Payment | Archive result                                               |
| ---- | ------- | ------------------------------------------------------------ |
| 0.20 | 1.20    | One half-dollar, one quarter, two dimes, five pennies        |
| 0.10 | 1.10    | Two half-dollars, minus one quarter, two dimes, five pennies |

The separate probe snapshots the compiled scalar slots while a later
INPUT waits. It records the signed exponent and two mantissa words.
Interpreting the words as described in the [PDP-8 Floating-Point System
reference, chapter 2](https://bitsavers.trailing-edge.com/pdf/dec/pdp8/software/DEC-08-YQYB-D_PDP-8_Floating-Point_System_Programmers_Reference_Manual_Sep69.pdf)
gives the following stored values. The printed dollar total alone hides
these differences.

| Cost | Payment | `C=P-A`              | `N=C*100`           | `G=N/50`           |
| ---- | ------- | -------------------- | ------------------- | ------------------ |
| 0.20 | 1.20    | 0.999999761581420898 | 99.999969482421875  | 1.9999995231628418 |
| 0.10 | 1.10    | 0.999999880790710449 | 99.9999847412109375 | 2                  |

The probe also stores decimal input `0.51` as `0.510000109672546387`.
A numeric display change alone leaves the denomination differences.

### Verified arithmetic words

The [arithmetic capture](edusystem30-arithmetic-reference.json) records the
signed operands and the results of addition, subtraction, multiplication,
and division for 57 pairs. The pairs exercise decimal inputs, mixed signs,
zero results, cancellation, and unequal exponents. Each result records
three octal words read from the original interpreter.

The [arithmetic checker](../scripts/research/check-edusystem30-arithmetic.py)
decodes each operand as an exact binary fraction. For addition, subtraction,
and multiplication, it computes the exact result, normalizes it, and truncates
the significand to 23 bits toward zero. Applying the same procedure to the
quotient differs in 41 of 57 cases.

In the archived division trace, the loop at octal `02250–02307` produces 23
quotient bits from the operand magnitudes. At `02312–02314` the routine
rotates the high remainder word twice through the PDP-8 Link register. The
addition at `02122` combines it with the high word of the negated divisor.
The resulting Link bit is added to the signed quotient before normalization.
With this correction, all three result words agree for all four operations
on every captured pair.

The arithmetic probes start from stored operands and test nonzero divisors.

```sh
python3 scripts/research/capture-edusystem30-change.py --arithmetic \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-arithmetic-reference.json
diff -u <(python3 -m json.tool docs/edusystem30-arithmetic-reference.json) \
  <(python3 -m json.tool /tmp/edusystem30-arithmetic-reference.json)
python3 scripts/research/check-edusystem30-arithmetic.py /tmp/edusystem30-arithmetic-reference.json
```

### Verified decimal INPUT conversion

The [INPUT capture](edusystem30-input-reference.json) records 66 typed values
and their scalar words. It covers the receipt amounts, signed zero, leading
and trailing decimal points, the integer precision boundary at 8388608,
and scientific exponents through ±300.

The archive accumulates whole and fractional digits separately. Each digit
passes through a multiply by ten and an add, with normalization after each
operation. The decimal scaling routine at octal `03146` uses a factor of
100000000 for each group of eight places, then a factor of ten for each
remaining place. It divides to scale down and multiplies to scale up.
It scales the fractional digits down before adding them to the whole part,
applies an explicit exponent to the sum, and applies the leading sign last.
This sequence explains why decimal `0.51` is stored slightly above 0.51.

The [INPUT checker](../scripts/research/check-edusystem30-input.py) matches
all three words for these 66 values and for the 114 operands in the
arithmetic capture.

```sh
python3 scripts/research/capture-edusystem30-input.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-input-reference.json
diff -u <(python3 -m json.tool docs/edusystem30-input-reference.json) \
  <(python3 -m json.tool /tmp/edusystem30-input-reference.json)
python3 scripts/research/check-edusystem30-input.py /tmp/edusystem30-input-reference.json \
  docs/edusystem30-arithmetic-reference.json
```

### Numeric PRINT evidence

The [PRINT capture and checker](edusystem30-print.md) match 263 archived
numeric fields, including receipt expressions and signs. The capture traces
the archived pre-display multiplication and fixed/scientific boundary. Public
CHANGE still requires applying the bounded numeric rules in the selected
profile and comparing complete receipts across the supported entry points.

```sh
python3 scripts/research/capture-edusystem30-change.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/change-edusystem30-reference.json
diff -u <(python3 -m json.tool docs/change-edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/change-edusystem30-reference.json)
```
