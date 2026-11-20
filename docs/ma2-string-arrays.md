# Selected BASIC-PLUS string arrays

The selected `basic-plus-v4a12-ma2` profile supports short string array names
(`A$`, `A0$`) in LET, PRINT and equality/inequality comparisons. String literals,
string scalars and string elements can supply assignments. INPUT continues to
accept scalar targets; a program can read a scalar and then assign an element.

The [archive capture](ma2-string-arrays-reference.json) checks the same cases on
V4A-12 software MA2 and V04B-17. Cells begin empty, bounds are inclusive from
zero, and an implicit string array has upper bound ten in each dimension.
One- and two-dimensional arrays use the existing MA2 numeric expression and
signed-word conversion for subscripts, which truncates fractions toward zero
before checking the array bounds. A later DIM controls earlier accesses.
The DIM bound controls the number of cells, rather than the length of each
string. A scalar and an array with the same name hold separate values.

The selected implementation retains its bounded string character and length
policy and shared array allocation limits. Numeric and string arrays share the
same detached `Basic.arrays` observation budget: 64 cells per array and 256
cells in total. String scalar assignments appear in `Basic.variables`, while
reading an unassigned string does not create a scalar assignment. Fresh runs
allocate empty string cells and discard prior scalar values. Duplicate DIM
and malformed source still fail during preparation before execution effects.

The tests cover source validation, assignment failure without a cell write,
RHS evaluation before target indices, frozen observations and fresh runs.
Concatenation and relational string operators beyond `=` and `<>` remain
outside this selected subset.

```sh
python3 scripts/research/capture-ma2-string-arrays.py \
  --simulator /path/to/simh/BIN/pdp11 \
  --v4a-disk /path/to/raw.dsk --v4b-disk /path/to/RSTS11v4B.DSK \
  --output /tmp/ma2-string-arrays-reference.json
```

See the [V4A build notes](rsts-v4a-build.md) and
[V04B archive provenance](nicoma-source-review.md#archived-rsts-v04b-17-replay).
