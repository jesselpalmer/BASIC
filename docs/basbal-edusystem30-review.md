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

## Recovered demonstration library

Attach two independent copies of the same pinned DECtape in SIMH. Boot the
system copy on DT0 and attach the program-library copy to DT1. The prior
single-drive capture stopped at octal `07312` because EDU30.SV selected unit 1.
SIMH reported a drive selection error when that transport was absent. With
both drives present, the unchanged archive's `CATALOG` identifies 16 programs,
including DEMON, BASBAL and BASBL1.

The recovered [DEMON](../scripts/package/fixtures/classic/demon-edu30-tape.bas)
is Tom Kloos's OMSI demonstration menu. The recovered
[BASBAL](../scripts/package/fixtures/classic/basbal-edu30-tape.bas) and
[BASBL1](../scripts/package/fixtures/classic/basbl1-edu30-tape.bas) are distinct
from the pinned corpus and the book transcription. The stored BASBAL differs
from the reviewed book at 450 (spaces inside the player's name) and 480
(keyword spacing). Stored BASBL1 adds a semicolon after the inning heading
at 190 and prints a period at 640. The capture records the normalized LIST
body separately from the fixture, which removes one trailing space from
DEMON line 807.

The [two-drive capture](edusystem30-omsi-reference.json) records the full
unmodified archive session. From DEMON, enter `BASEBALL` and the team name
`RSTS/E ROCKETS`. Use BUNT on offense and FASTBALL on defense. After 71 plays,
the game prints its fourth completed inning, a 3–0 computer win, and the DEMON
prompt. `LIST` at the returned menu prints the demonstration catalog again.

The isolated handoff probes use a separate disposable copy of the library.
They enable the normal SAVE command through its in-memory SIMH flag to create
short targets. CHAIN clears scalar and array contents, resets the RNG to its
default stream, and discards explicit dimensions. A target without its own
DATA reads the caller's data list starting at the first item. An explicit
WRITE followed by RESTORE passes the updated list. The missing-target probe
reports `ERROR CH AT LINE 0010`.

```sh
python3 scripts/research/capture-edusystem30-omsi.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-omsi-reference.json
```

## Play the recovered game

Select the OMSI baseball example in the web interpreter, click **Run**, and
enter `BASEBALL` at the DEMON menu. Enter a team name, then follow the play
options printed by the program. The baseball path uses
[DEMON](../examples/omsi/DEMON.bas), [BASBAL](../examples/omsi/BASBAL.bas), and
[BASBL1](../examples/omsi/BASBL1.bas). The playground also supplies
[ZOOP](zoop-edusystem30.md) and [WEKDAY](wekday-edusystem30.md). DEMON lists the original tape catalog. The game returns to DEMON when it ends. Use **Stop** at a prompt
to leave the session.

For the CLI or editor, export the browser example as a `.basic.json` file
to preserve its `edusystem-30-mark` profile. From the repository root, pass
the directory of available programs explicitly:

```sh
bun ./bin/basic --chain-dir examples/omsi /path/to/demon.basic.json
bun ./bin/basic --chain-dir examples/omsi
```

In the editor session, enter `LOAD "/path/to/demon.basic.json"` and `RUN`.
The installed library accepts the same source via `parseProgram` with
`{dialect: 'edusystem-30-mark'}` and a `Basic` host with `loadProgram(name)`.
The host receives six characters (`BASBAL`, `BASBL1`, `DEMON `). The CLI
resolves these to `BASBAL.bas`, `BASBL1.bas`, and `DEMON.bas` in its explicit
directory.

The portable sources separate compact keyword boundaries, such as `1TO19`
and `4THEN160`, and spell DEMON's `GO SUB` as `GOSUB`. They keep the tape
listings' line numbers, string literals, data, and control flow. BASBAL
allocates 50 cells above zero but loops to 99. BASBL1 allocates 16 cells
above zero but loops to 20. The captured inputs terminate with Return
before either loop reaches an out-of-bounds subscript.

The package and browser acceptance tests replay the archive's 71 plays
and `LIST` after the return to DEMON. They compare the full game and menu
output after accounting for the archive monitor's RUN banner and the
terminal's operator-echo line endings.

An indexed read such as `INPUT $A(I)` submits a printable ASCII line on the
public host. Each character statement stores one byte, then stores Return
after the last character. SPACE stores the ASCII value and MARK sets bit 7.
An intervening scalar character read consumes an already buffered byte.
Scalar reads starting without a buffer still ask for one character. Numeric
INPUT can read the remaining line after it uses any previously retained
numeric fields. A fresh RUN discards unread character and numeric input.

Reproduce the focused parity and input-order probes with the same archive:

```sh
python3 scripts/research/probe-edusystem30-indexed-input.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```

BASBAL initializes scalar `X` and fills `C`, `F` and `Z` arrays from DATA.
BASBL1 reads `C(X)` and `F(X)` at 310 and 320 and reads and updates `C(Y)`
and `Z(Y)` during play. It has no corresponding DIM or roster DATA. Its
line 110 assigns `Z(0)=.5` and a separate scalar `Z=.5`. The published
listings contain no `WRITE` or `RESTORE` handoff. The January 1973
[DEC handbook, §§7-5–7-8](https://deramp.com/downloads/mfe_archive/011-Digital%20Equipment%20Corporation/00%20Digital%20Handbooks/08%20PDP-8%20Family/Edusystem%20Handbook/EduSystemHandbookJan73.pdf#page=293)
describes six-character CHAIN names and passing data through a data file.
The public game uses implicit numeric arrays after CHAIN resets the
variables. Separate runtime tests cover the DATA handoff because BASBL1
has no READ. The recovered DEMON remains outside the 108 pinned corpus
listings.

```sh
python3 scripts/research/capture-edusystem30-basbal.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --corpus /path/to/pinned/corpus --output /tmp/basbal-edusystem30-reference.json
```
