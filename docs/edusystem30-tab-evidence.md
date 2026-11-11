# EDUSYSTEM-30 TAB evidence

The probe runs small listings on the archived `EDU30.SV` using SIMH commit
`698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6`. The working tape is copied from
the pinned archive with SHA-256
`281c9c5f125996d3496c7118e4601e20c7f29320e4abc7626d26de01502a081a`.

## Column movement

For `PRINT "ABC";TAB(n);"X"`, `ABC` occupies three positions. The cases
below use Python byte-literal notation. The carriage return and NUL within
a row are terminal control bytes. The final carriage return and line feed
come from `PRINT` ending its line.

| `n`      | Output bytes                    |
| -------- | ------------------------------- |
| `0`      | `b'ABC\r\x00X\r\n'`             |
| `2`      | `b'ABC\r\x00  X\r\n'`           |
| `2.0001` | `b'ABCX\r\n'`                   |
| `3`      | `b'ABCX\r\n'`                   |
| `3.0001` | `b'ABC X\r\n'`                  |
| `4.49`   | `b'ABC  X\r\n'`                 |
| `69.9`   | `b'ABC' + b' ' * 67 + b'X\r\n'` |
| `70`     | `b'ABC\r\x00X\r\n'`             |
| `70.1`   | `b'ABC\r\x00 X\r\n'`            |
| `142`    | `b'ABC\r\x00  X\r\n'`           |
| `-.5`    | `b'ABC' + b' ' * 67 + b'X\r\n'` |
| `-1`     | `b'ABC' + b' ' * 66 + b'X\r\n'` |
| `-70`    | `b'ABC\r\x00X\r\n'`             |

The tested targets agree with wrapping the fractional argument to a
nonnegative remainder modulo 70, then rounding up to a whole column. A target
equal to the current column emits no padding. A lower target emits carriage
return and NUL before padding from column zero. The `69.9` case reaches column
70 before printing `X`, while the exact argument `70` resets to column zero.

```bas
150 PRINT TAB(4);"B";
160 PRINT TAB(2);"C";
170 PRINT TAB(6);"D"
```

These three statements emit `b'    B\r\x00  C   D\r\n'`. The physical
column persists across a trailing semicolon and resets at the carriage return.

The reviewed DIAMND needs numeric `TAB` arguments and column state shared
across `PRINT` statements, along with `FOR ... STEP` in both directions and
the negative expression on line 85. Its valid odd inputs use nonnegative
integral TAB targets within a single line. The archived DIAMND constant table
discrepancy is separate from these terminal observations.

```sh
python3 scripts/research/probe-edusystem30-tab.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
