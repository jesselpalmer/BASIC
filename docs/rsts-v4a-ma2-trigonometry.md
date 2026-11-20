# Selected BASIC-PLUS software MA2 trigonometry

The selected `basic-plus-v4a12-ma2` profile evaluates numeric `SIN`, `COS`
and `TAN` through the original stored arithmetic sequence. Each accepts one
numeric expression. This supplies the two formulas used by the randomized
[FIPFOP replay](fipfop-rsts-review.md#varying-q-replay-on-both-basic-plus-builds).

## Original routine and operation order

The [pinned V4A-12 build](rsts-v4a-build.md) uses MA2.OBJ payload SHA-256
`6d27b8d91ed33666292ef909472365dc19451275de20e56305be0d6d0ef1f303`
and SY.LDA payload SHA-256
`e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596`.
The MA2 section begins at octal `071600` in that linked image.

Sine's argument-checking entry is section offset `011454`, followed by its
numeric body at `011512`. Cosine's entry at `011464` adds the stored
half-pi before entering the same body. Tangent's entry at `002064` saves
the original argument, calls sine and cosine, and divides their results.
The reproduction command calls numeric bodies at linked addresses `103312`,
`103272` and `073672`, with an already-stored argument at `140000`.

Sine saves the sign and divides the absolute magnitude by the stored full
turn `[040711,007733]`, approximately 6.2831854820251465. It subtracts the
integer number of turns, multiplies the remaining fraction by four with an
exact exponent adjustment, then folds the quadrant into the closed interval
[0, 1]. The stored sine polynomial uses these high/low word pairs, in descending
powers of the squared folded fraction.

| Power of squared fraction | High word | Low word |
| ------------------------: | --------: | -------: |
|                         4 |  `035036` | `153672` |
|                         3 |  `136231` | `023143` |
|                         2 |  `037243` | `032130` |
|                         1 |  `140045` | `056741` |
|                         0 |  `040311` | `007733` |

The machine evaluates the polynomial with the squared fraction as the left
multiply operand and the current coefficient as the right operand. Its final
multiply places the folded fraction on the left. The existing
[MA2 multiplication](basic-plus-ma2-multiplication.md) is sensitive to operand
order, so reversing those factors changes captured results by one or two ULPs.
Every multiply, addition, subtraction and division retains MA2 words.
Cosine adds the stored half-pi `[040311,007733]` to the signed input before
sine's absolute-value step. Tangent evaluates both functions at the original
input and uses the original divide.

## Independent word capture

The [offline vectors](../src/core/__tests__/ma2-trigonometry-reference.json)
contain 1,011 original-machine calls across zero, both signs, half-pi and
full-turn neighbors, large integers, exponent and significand boundaries,
and fixed-seed inputs. Normal rows retain exact result words. Numeric-event
rows stop at the original trap and retain the event code, with null result
words. No output comes from the TypeScript implementation.

These vectors include the FIPFOP case `TAN(262136)`, whose result words
observe as approximately 13.556670188903809. Direct JavaScript tangent at
that input is approximately 16.157516060745472. Stored range reduction
and the original polynomial reproduce the archived result.

The machine can create signed zero after restoring a negative input sign.
Eighty captured sine/cosine results have words `[32768,0]`. The selected
value model reports `UNSUPPORTED_MA2_VALUE` with reason `signed-zero` at
that function instead of admitting the noncanonical value. Within tangent,
the original divide recognizes zero by exponent before sign, so the internal
signed-zero numerator or denominator follows the captured division behavior.
Tiny-input underflow and zero-denominator tangent report the first located
MA2 numeric event. Continuation after those events remains separate work.

```sh
python3 scripts/research/capture-ma2-trigonometry.py \
  --simulator /path/to/simh/BIN/pdp11 --loader /path/to/rebuilt/SY.LDA \
  --output /tmp/ma2-trigonometry-reference.json
```

The capture checks the loader hash and reported simulator revision, leaves
historical instructions intact, and limits each call to 10,000 instructions.
An authored return address points to a scratch HALT. The command observes
normal completion or the original arithmetic trap without executing an
inline mask as code. Normal tests consume the recorded vectors offline.
