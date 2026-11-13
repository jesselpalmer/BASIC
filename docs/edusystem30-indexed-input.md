# EDUSYSTEM-30 indexed numeric INPUT

The OMSI HORSES listing reads the wager into `T(S)`. The archived
`EDU30.SV` stores numeric input in the element selected by the current index
expression. The same rule applies to rank-two arrays and to implicit rank-one
arrays. A later numbered DIM supplies the bounds from the first access.
Input to an array element leaves a scalar of the same name alone.

Within an INPUT list, earlier assignments are visible when resolving later
indices. For example, with `INPUT I,A(I),A(A(I))`, replying `2,3,17` sets
`I` to 2, `A(2)` to 3, and `A(3)` to 17. A malformed field is retried
before an out-of-bounds subscript reports an error at the INPUT line.

The portable profile admits up to three numeric targets and waits for all
fields before committing them. Cancelling a partial read preserves all
targets. The archive also accepts at least four targets and checks each
subscript after its own field, so an early invalid subscript may be reported
before prompting for a later missing field.

The [reference transcripts](edusystem30-indexed-input-reference.json)
omit the OS/8 banner, echoed answers, and final READY prompt. Verify them
against the pinned DECtape with:

```sh
python3 scripts/research/probe-edusystem30-numeric-input.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
