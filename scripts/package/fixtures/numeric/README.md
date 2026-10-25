# Numeric formula acceptance fixture

This is a new test program containing short expressions from the pinned
[101 BASIC Computer Games corpus](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/tree/45f75052be3f436f2e575f58d4aa611484268227):

- `rocket.bas`15: `1E-3`.
- `rockt2.bas`70: `LET A1=8.84361E-04`.
- `bounce.bas`220: the height expression; FOR is replaced with an assignment
  wrapper so this tests the expression independently of historical loop rules.
- `target.bas`510: the complete distance assignment, unchanged.

Setup, labels, REM lines and output assertions are new. This is not any complete
source listing, game outcome or dialect certification. It is deliberately separate
from the raw/corrected corpus ledger. The arithmetic oracles are 16 for the
height at V=32, and 13 for the distance from (0,0,0) to (3,4,12).

The original manual/scan provenance is recorded in the compatibility docs.
