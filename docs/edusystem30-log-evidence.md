# EDUSYSTEM-30 logarithm

The [archived EDU30.SV capture](edusystem30-log-reference.json) records the
stored argument and result words and the exact PRINT field. The archive
reports `ERROR LG` for zero and computes the logarithm of the magnitude
for negative arguments. The selected implementation reports a located
domain diagnostic for zero.

The routine at octal `03243–03331` takes the magnitude and computes its
stored reciprocal when the magnitude is less than one. Let the resulting
stored positive number be `2^n * m` with `1 <= m < 2`. It computes `t = m-1`
and evaluates the following polynomial, storing every arithmetic result
with EDU30 precision.

```text
p = (((((((c7*t + c6)*t + c5)*t + c4)*t + c3)*t + c2)*t + c1)*t + c0)
result = (p*t) + (n*ln2)
```

For the reciprocal path it then negates the result. The following are the
stored three-word coefficients in octal. Negative significands in this
table are in the archive's two's-complement encoding.

| Coefficient | Address | Stored exponent, high word, low word |
| ----------- | ------- | ------------------------------------ |
| c7          | 03360   | `7771 4544 1735`                     |
| c6          | 03355   | `7774 2236 4304`                     |
| c5          | 03352   | `7775 4746 0771`                     |
| c4          | 03347   | `7776 2535 3301`                     |
| c3          | 03344   | `7776 4113 7211`                     |
| c2          | 03341   | `7777 2517 0307`                     |
| c1          | 03336   | `7777 4000 4100`                     |
| c0          | 03333   | `0000 3777 7742`                     |
| ln2         | 03363   | `0000 2613 4414`                     |

To observe the routine, run the INPUT probe in the reference JSON, break at
octal `01216` in SIMH before submitting `1.234569`, then stop at `03243`.
The logarithm overlay is present at that breakpoint. The floating instruction
dispatcher at `01404` reads its stream pointer from word `01400`. Inspect
words `025–027` at each dispatch to observe the stored intermediate result.
The archive probe includes arguments from `1E-300` through `1E300`, powers
of two, values near one and negative arguments. Exponent overflow in the
reciprocal or another intermediate remains outside the selected contract.

```sh
python3 scripts/research/capture-edusystem30-log.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-log-reference.json
```
