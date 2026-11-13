# Selected BASIC-PLUS CHANGE

The selected `basic-plus-v4a12-ma2` profile accepts `CHANGE A$ TO A1`
from a short string scalar to a rank-one numeric array. Element zero stores
the byte count. The next elements store unsigned byte codes and the remaining
elements keep their values. A fresh RUN clears the array. An unassigned string
reads as empty. An implicit target has indices 0 through 10.

The reconstructed [RSTS V4A-12 MA2 build](rsts-v4a-build.md) produced these
values at indices 0–3 when the same `DIM A1(6)` target was reused.

| Source  | Element 0 | Element 1 | Element 2 | Element 3 |
| ------- | --------: | --------: | --------: | --------: |
| `"012"` |         3 |        48 |        49 |        50 |
| `"9"`   |         1 |        57 |        49 |        50 |
| `""`    |         0 |        57 |        49 |        50 |

The archived build also accepted the compact spelling `CHANGEA$TOA1`,
stored character codes 0, 128 and 255 as unsigned values, and reported
`SUBSCRIPT OUT OF RANGE` for three characters with `DIM A1(2)`. With an
implicit target, it accepted ten bytes and reported the same diagnostic
for eleven bytes. The public profile reports a located `ARRAY_BOUNDS`
before writing any cells when the string exceeds capacity. Array-to-string
conversion and rank-two targets remain outside the selected profile.

Reproduce the four probes on the reconstructed raw disk before REFRESH.

```sh
python3 scripts/research/probe-ma2-change.py \
  --simulator /path/to/pdp11 --disk /path/to/raw.dsk
```
