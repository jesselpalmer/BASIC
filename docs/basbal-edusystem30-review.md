# BASBAL and BASBL1 source review

The March 1975 [description, listing and sample on printed pages 26–28](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=26)
credit Jack Huisman at the Oregon Museum of Science and Industry. The
chapter names DIGITAL EduSystem 15/30/35 and calls for `NOLINE`. Both
listings carry an `EDUSYSTEM-35` header. The sample header instead names
`BASEBL` and gives the time and date as `01:38 PM 16-MAY-73`.

The [BASBAL](../scripts/package/fixtures/classic/basbal-mar75-text.bas) and
[BASBL1](../scripts/package/fixtures/classic/basbl1-mar75-text.bas) fixtures
preserve the printed listings separately from the [pinned upstream corpus](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/tree/45f75052be3f436f2e575f58d4aa611484268227)
bytes. BASBAL restores indexed character input at 140, output separators
at 130, 170 and 250, and the negative DATA values at 330–350. BASBL1 restores
the separator at 190, indexed character input at 280, and `CHR$` at 410.
Its corrected comparisons include the inning outcome at 1430, where equal
scores branch to `A DRAW!`. Line 210 ends the game when `I=5`, even though
the description says nine innings. The reviewed listing keeps the printed
inning test.

## Archived execution

The [reference capture](basbal-edusystem30-reference.json) pins the source
hashes and observations on archived `EDU30.SV` with `NOLINE`.

- Literal corpus BASBAL reports `S2 140`. Literal corpus BASBL1 reports
  `S1 410`.
- Reviewed BASBAL accepts `RSTS/E ROCKETS`, prints the team table and
  the play options, and prints the team name in the opening play. It then
  enters the DECtape controller path at `CHAIN "BASBL1"`. The capture
  reproduces the crowd of 40,778 on this archive. The printed sample
  reports 53,971 and gives more digits for the batting averages.
- Reviewed BASBL1 starts independently. The bounded opening accepts
  `ZZ`, `BUNT`, `SWING` and `HIT-AWAY`, producing a retry, an out, a ball and
  a strike. It starts from its own initial state in this capture.
- A separate indexed character-input probe stores `A` as 193 and Return
  as 141 in successive cells. `CHR$(193)` prints `A`.
- The short `CHAIN "DEMON "` probe reaches the same tape-controller
  instruction as BASBAL. The capture ends after a bounded three-second
  observation and a breakpoint at octal `07312` on instruction `6773`.
  It establishes neither a successful load nor the missing-name diagnostic.

## Requirements for the two-part game

The public selected runtime currently rejects the reviewed compact source
at BASBAL 110 (`1TO19`) and BASBL1 150 (`4THEN160`). Even with explicit token
spacing, the game needs character input into numeric array cells. One
submitted team name or play must feed successive character reads, including
its final marked Return. BASBAL allocates 50 cells above zero but loops to 99. BASBL1 allocates 16 cells above zero but loops to 20. Acceptance should
cover these original bounds and the early exit on Return.

BASBAL initializes scalar `X` and fills `C`, `F` and `Z` arrays from DATA.
BASBL1 reads `C(X)` and `F(X)` at 310 and 320 and reads and updates `C(Y)`
and `Z(Y)` during play. It has no corresponding DIM or roster DATA. Its
line 110 assigns `Z(0)=.5` and a separate scalar `Z=.5`. The published
listings contain no `WRITE` or `RESTORE` handoff. The January 1973
[DEC handbook, §§7-5–7-8](https://deramp.com/downloads/mfe_archive/011-Digital%20Equipment%20Corporation/00%20Digital%20Handbooks/08%20PDP-8%20Family/Edusystem%20Handbook/EduSystemHandbookJan73.pdf#page=293)
describes six-character CHAIN names and passing data through a data file.
A successful archive chain or another original source is needed to establish
whether the initialized values, array dimensions and random stream continue
into BASBL1. The pinned corpus contains BASBL1 and contains no `DEMON` file.
Resolving that final transition is a separate asset requirement for a complete
game.

```sh
python3 scripts/research/capture-edusystem30-basbal.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --corpus /path/to/pinned/corpus --output /tmp/basbal-edusystem30-reference.json
```
