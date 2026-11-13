# OMSI HORSES compatibility evidence

The [source review and playthrough](horses-edusystem30.md) record the
recovered OMSI HORSES listing, the published listing, and the two tape
transcripts replayed by the public EDUSYSTEM-30 MARK profile.

The focused probes verify that stock EDU30.SV stores an input into a
calculated array element and permits a GOSUB into a lexical FOR body before,
during, and after the corresponding loop is active. HORSES uses indexed
numeric INPUT at lines 300 and 430 and calls the horse-name routine at 1880
from lines 1160 and 1430. Both the tape and portable listing return from the
subroutine before reaching NEXT in that body. The probes leave NEXT without a
matching FOR open. Native and selected BASIC-PLUS transfers have separate
evidence.

```sh
python3 scripts/research/probe-edusystem30-horses.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
