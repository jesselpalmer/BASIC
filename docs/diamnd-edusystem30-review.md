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
center row contains `DEC` followed by 28 exclamation points. The probe
adds output statements inside the loop, so its transcript describes the
instrumented program. DIAMND remains blocked on matching the printed
pattern with the reviewed listing.

```sh
python3 scripts/research/probe-edusystem30-diamnd.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
