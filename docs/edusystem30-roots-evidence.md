# EDUSYSTEM-30 square roots and powers

The [pinned EDU30.SV capture](edusystem30-roots-reference.json) records the
operand and result words and the printed result for `SQR` and integer powers.
The capture uses numeric `INPUT` for operands to isolate runtime arithmetic
from the archived compiler's source-literal conversion.

The integer power path at octal `01700–01737` shifts the exponent right one
bit at a time. Each set bit multiplies the accumulator by the current base,
and each shift squares the base. In particular, `0.1^4` and `0.1^5` distinguish
this order from repeatedly multiplying by the original base at stored
precision. The [extended capture](edusystem30-roots-reference.json) checks
numeric INPUT exponents, zero and one, negative bases, and larger integer
powers through `20`. This covers BOUNCE's expression `C^(I-1)` in the
selected runtime. The selected profile evaluates an exponent expression at
stored precision and accepts integer results from `0` through `20`. A
negative or fractional result raises a located numeric domain error.
The archived interpreter stops with `LG` for `0^0`. The selected runtime
reports a located numeric domain error.

`SQR` starts at octal `02451`. At `02463–02475`, the routine halves the
stored exponent, rounding up, and sets the estimate's mantissa words to
`3015 0000`. It evaluates `(x/y+y)/2` using the stored division and addition.
At `02507–02530`, it compares the new estimate with the previous estimate
and returns the new one once the exponent and high mantissa word agree and
the low words differ by at most one. These rounding points explain why the
stored result can be above or below the exact square root. Zero returns zero.
For a negative operand, the archive prints diagnostic `SQ` and continues with
the magnitude. The selected runtime reports a source-located numeric domain
error before effects, consistent with its bounded diagnostic policy.

Regenerate the captured words and output with the pinned PDP-8 simulator and
tape used by the [classic source reference](classic-source-review.md).

```sh
python3 scripts/research/capture-edusystem30-roots.py \
  --simulator path/to/pdp8 --tape path/to/edu30.tu56 \
  --output /tmp/edusystem30-roots-reference.json
```
