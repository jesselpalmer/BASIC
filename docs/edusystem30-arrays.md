# EDUSYSTEM-30 explicit numeric arrays

The selected profile supports positive literal bounds in one-dimensional
numeric DIM declarations. A line can declare several arrays. The archived
interpreter accepts a DIM declaration after the first indexed access and
keeps a scalar distinct from an array with the same name.

Cells start at zero on each RUN. A declaration such as `DIM A(3)` allows
indices 0 through 3. The archived interpreter truncates nonnegative indices
before checking the upper bound. `A(3.5)` accesses cell 3, and a negative
fraction or an index of 4 produces the archived SS diagnostic. The selected
profile reports `ARRAY_BOUNDS` at the index expression. It preserves stored
values in indexed reads and assignments and observes them as JavaScript
numbers in array snapshots.

The selected profile uses the shared interpreter's array allocation limits.
Archived programs can exhaust PDP-8 memory at smaller bounds, depending on
the compiled program. Implicit DIM, multiple dimensions, indexed INPUT,
and duplicate DIM semantics remain outside this selected slice.

The probe checks two fresh RUNs for each case against the same pinned interpreter
and tape used in the [EDUSYSTEM-30 profile](edusystem30-profile.md).

```sh
python3 scripts/research/probe-edusystem30-arrays.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
