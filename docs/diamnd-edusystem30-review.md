# DIAMND archive review

The [March 1975 printing, pages 87–88](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=87)
credits Digital Equipment Corporation and shows a size-15 pattern. The pinned
[transcription](../scripts/package/fixtures/classic/diamnd.bas) has 30 lines
and SHA-256 `d8da61641ee23354bcc763ab2d69002fe4e68dce31829c2a6d8ac99023d162fb`.
The [reviewed fixture](../scripts/package/fixtures/classic/diamnd-mar75-text.bas)
restores the exclamation point in the string on line 35, where the pinned
transcription has a space. Its SHA-256 is
`15ec624beae75585d8881fdb08607aa52bf6ac27ee671c8f093f0959d412ba5a`.
The printed listing leaves the runtime unspecified.

## Archived execution

The archived EDU30.SV build accepts 5, 15 and 31 and returns to READY. After
each response it emits two newlines and no pattern. An instrumented size-31
run prints row widths from 1 to 31 and back to 1 in steps of two, and the
center row contains `DEC` followed by 28 exclamation points.

At size 15, adding only `61 PRINT "PRINTED"` after the end-of-row `PRINT`
makes the archive emit 60 pattern rows, each followed by the diagnostic
marker. The probe checks every row's indentation, the four repeats per row,
and the four vertical repeats.

```sh
python3 scripts/research/probe-edusystem30-diamnd.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```

## Compiled constant table

At the input prompt, the reviewed listing and the line-61 variant already
have different constant tables in PDP-8 data field one. Breakpoint `00322`
stops at the first load from that table after the response, at BASIC line 6.
The original RUN loads `1` for the `60` in `Q=INT(60/R)`, sets `Q` to zero,
and skips from the outer `FOR` on line 8 to `END` on line 99. The line-61
variant loads `60` in the same operation.

| Value in the working table | First address (octal) | Reviewed listing words | Line-61 variant words |
| -------------------------- | --------------------- | ---------------------- | --------------------- |
| 1                          | `10403`               | `0001 2000 0000`       | `0001 2000 0000`      |
| 70                         | `10406`               | `0000 0000 0000`       | `0007 2140 0000`      |
| 60                         | `10411`               | `0001 2000 0000`       | `0006 3600 0000`      |
| 2                          | `10414`               | `0000 0000 0000`       | `0002 2000 0000`      |
| 3                          | `10417`               | `0001 2000 0000`       | `0002 3000 0000`      |

Copying the eight differing words from the working table with the simulator
debugger gives 60 pattern rows at size 5, 60 at size 15, and 31 at size 31.
Every row matches the expected geometry, using the reviewed source bytes in
each run. The trigger for the bad table during archive compilation or loading
is still open.

## Selected profile

The `edusystem-30` profile reads the reviewed listing and evaluates the
constants in its source. Library, installed CLI/editor and browser tests
match the full [repaired archive transcripts](diamnd-edusystem30-reference.json)
at sizes 5, 15 and 31, including every row's indentation. The browser runs
each size from a fresh session and scrolls horizontally to preserve columns.
Choose **DIAMND · EDUSYSTEM-30 selected
profile** in the playground and enter an odd size from 5 to 31.

```sh
python3 scripts/research/probe-edusystem30-diamnd-constants.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/diamnd-edusystem30-reference.json
diff -u <(python3 -m json.tool docs/diamnd-edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/diamnd-edusystem30-reference.json)
```
