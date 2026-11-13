# EDUSYSTEM-30 exponential

The [pinned EDU30.SV capture](edusystem30-exp-reference.json) records the
stored INPUT and EXP result words and the archived PRINT field. Samples
include both signs, zero, tiny magnitudes, operands near `ln(2)`, negative
fractional operands within 3DPLOT's range, and the selected profile's
large-magnitude limits at `-700` and `700`.

The routine at octal `03001–03055` saves the sign and scales the magnitude
by its stored approximation of `1/ln(2)`. It extracts the integer part
`n` and subtracts it to obtain the remaining fraction `f`. The archived
floating instruction stream at `03016–03042` evaluates

```text
s = f * f
q = f / (e * s + ((c / (s + b) - f) + d))
p = 1 + 2 * q
```

Each arithmetic operation stores an EDU30 result. The routine doubles
`q` by incrementing its exponent. The first addition forms `s + b`,
and the last denominator addition uses `e * s` as the first operand.
The constants occupy `03056–03074` in the archived image.

| Constant | Stored exponent, high word, low word (octal) |
| -------- | -------------------------------------------- |
| Scale    | `0001 2705 2435`                             |
| b        | `0007 2566 5341`                             |
| c        | `0012 5454 0343`                             |
| d        | `0004 2372 1402`                             |
| e        | `7774 2157 5157`                             |

The routine adds `n` to the stored exponent of `p`. A negative original
argument takes the stored reciprocal. The selected profile accepts stored
zero or a stored magnitude from `2^-1000` through `700`. The lower bound
keeps the intermediate square and correction in the stored exponent range.
The upper bound keeps results observable through the host number boundary.
For smaller nonzero magnitudes the archive can wrap the intermediate
exponent. For example, the compiled source `PRINT EXP(1E-400)` prints
`4E401` in the archive. The selected profile reports a located numeric
domain error for arguments outside its supported range.

Regenerate the capture with the simulator and tape pinned by the
[classic source reference](classic-source-review.md).

```sh
python3 scripts/research/capture-edusystem30-exp.py \
  --simulator path/to/pdp8 --tape path/to/edu30.tu56 \
  --output /tmp/edusystem30-exp-reference.json
```
