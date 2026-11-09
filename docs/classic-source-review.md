# Classic source review records

This records evidence and remaining blockers for #115. It does not declare a
whole dialect or the corpus compatible. The [structured ledger](classic-games-ledger.json)
contains all 108 pinned files, raw hashes/sizes, book references, provisional
attribution, observed feature labels, first native diagnostic and explicit
unresolved status. No file has a complete historical compatibility pass. 23MTCH now has the partial
native loss/replay observation described below.

## Evidence rules

A README label is a lead, not a verified dialect. A printed sample identifying
its system is stronger evidence, but still does not replace the relevant manual.
A source spelling that works in BASIC-PLUS need not be valid on DECsystem-10.
Keep these separate: original system attribution, documented compatible forms,
transcription differences, source defects and execution results.

The ledger's feature index is a conservative textual search aid: quoted strings
and leading comments are omitted, compact words are retained and continuation
lines may be missed. It cannot prove completeness, validate grammar, choose a
profile or rewrite a file. Unknown rows remain blockers. Book reference pages
come from upstream README unless explicitly marked verified; companion helpers
retain their parent's reference and an unresolved exact listing page.

The source audit remains open until every row has its own defensible disposition.
Work on an independently verified construct can proceed after its own design is
settled; that does not remove any other file from the release requirement. The
whole-corpus and per-profile gates remain in #109/#114/#115/#116/#129.

## 1CHECK

### Tested corrected native path

The original two fixtures retain the pinned raw bytes and the reviewed one-character
line74 template-delimiter correction. The fixture README records both hashes and
scan provenance; tests assert exactly one changed byte. Raw source still fails
before effects at line74 rather than being repaired by the interpreter.

The corrected listing runs a complete scripted native path through library,
installed ESM/CommonJS and CLI, and the actual browser/static artifact: exact
eight-row 1..64 numbering, the 48-piece opening, illegal 1-to-2 without mutation,
legal 1-to-19 clearing squares1/10 and setting19 (47 pieces), zero to summarize,
MAYBE retry, YES rebuilding 48 pieces, and NO exiting normally at END999. Every
piece-board row is compared with an independent expected string. The loaded
corrected snapshot can rerun after a rejected raw replacement; browser export and
reload preserve its exact bytes, and Stop leaves its source available.

This is a **corrected native path**, not a full historical compatibility pass.
Native unformatted numbers still have compact spelling, so its summary includes
`YOU MADE1JUMPS AND HAD47PIECES`. Historical numeric padding/profile certification
and broader compatibility remain open. No source/game logic is silently changed.

The explicit native array slice now has an independently authored board/move
fixture (`scripts/package/fixtures/arrays/board.bas`) covering the 48-piece start,
an unchanged illegal move, the 47-piece legal jump and fresh reruns. It is a
feature oracle, not the raw or corrected listing and not a whole-game pass.
Native string-involved adjacency and integer PRINT USING are now accepted;
historical formatting and profile certification remain blockers. The ledger's
first-native-diagnostic fields retain their stated
historical baseline commit rather than pretending to be current parser results.

- Upstream file: `1check.bas`, pinned by the ledger's raw SHA-256.
- Supplied verbatim by Jesse in this conversation as well as available upstream.
- Author in the book: David Ahl. Description is printed page 163; the listing and
  sample run are printed page **164**, PDF page **166**, leaf **n165** of the
  [available scan](https://archive.org/details/101basiccomputer0000davi/page/n165/mode/1up).
- The first scan's catalog year is 1974; the follow-up below independently
  verifies the March1975 third-printing imprint named by upstream. Do not call
  every transcription difference an OCR error.
- Scan PDF SHA-256:
  `c8a7549a649e9b6a99d80cab9ec8e3d78f6a872f127daee617fe692c40b92867`.

### Reviewed difference

Line 74 in the supplied/upstream transcription places `;` after `B$`; the scan
visibly places `,` there. Both reviewed DEC manuals use a comma between the
format expression and the item list. A correction must retain the raw source
and replace that one character only. Record a corrected hash and patch; do not
silently apply it in the interpreter or count it as an unchanged-source pass.
Spacing in the format string is preserved from the chosen fixture; the available
scan has spacing differences, so it is not a byte-identical book transcription.

### Whole-listing review and attribution limits

The complete listing on printed page 164 was visually compared with all **85
numbered source lines**, from 5 through 999, in the pinned 86-physical-line file.
The description/author page 163 and listing/sample page 164 are one-based PDF
165/166 in the same hash-pinned scan above. The review checked labels, variables,
arithmetic operands, array references, branch targets and loop bounds. It found
no additional verified arithmetic or control-flow difference in the readable
text; that is narrower than byte-for-byte source certification.

The follow-up [March 1975 scan](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf)
has SHA-256 `311c1be8d3c9361ee9badb59b5a43c43a5b0bf4803298943be1cb617b8f33ad7`
(26,006,648 bytes, 252 PDF pages). Its **printed/PDF page2** explicitly lists
third printing, March1975; this edition identity comes from the imprint, not the
archive filename. Description and listing/sample are printed/PDF163/164 in this
copy. These page numbers must not be reused as PDF indices for the earlier scan.
The later scan was visually inspected at 250dpi, including all85 numbered labels
and the sample. It resolves the three faint separators in the earlier copy:

| Labels  | Reviewed agreement / remaining uncertainty                                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5-68    | Instruction text, numbered-board introduction and DIM A(64) are present. Quoted content is resolved separately below; physical typesetting is not byte-certified.                                                            |
| 70-98   | Numbering loop, array initialization, central clearing loops, M=0 and GOTO 340 agree. Line72 matches the March1975 copy; line74's comma remains the minimal fixture's sole correction.                                       |
| 100-112 | F/T input and the zero-to-summary branch agree. Both INPUT separators, including110, are visibly semicolons in the March1975 copy, matching the fixtures.                                                                    |
| 118-290 | Coordinate arithmetic, range/diagonal/occupancy checks, illegal-move branch and three-cell update/M increment agree. The March1975 illegal-move text, including three periods, matches the fixture.                          |
| 310-410 | Eight-row nested printing loops and return to input agree. Line360 visibly ends with a semicolon in the March1975 copy, matching the fixtures.                                                                               |
| 490-999 | Sum, M/S summary operands, YES/NO branches and END agree. Line562's INPUT separator is visibly a semicolon, matching the fixtures. Raw/minimal quoted spaces at550/580/610 differ; the separate fixture resolves them below. |

The March1975 glyphs at110/360/562 have upper dots as well as lower comma tails;
compare the clear semicolon at100 and comma after B$ at74 on that same page.
They support the preserved semicolons, not three further source corrections.
The corrected fixture still changes **only line74**. Its raw/corrected hashes,
2042-byte sizes and86 physical lines remain unchanged. Matching the printing
named by upstream removes the earlier edition-comparison limitation for this
review; it does not make that upstream transcription lossless.

The [follow-up quoted-text review](1check-reviewed-text.md) checks all25 literals
on23 labels at400dpi and resolves the three remaining differences at550/580/610.
A third fixture, `1check-mar75-text.bas`, adds exactly those three spaces to the
minimal correction; raw and minimal fixtures stay unchanged. In the March1975
copy, line72's format spacing and line230's three terminal periods match the
preserved source, and line78 has no extra trailing blank. The new fixture's exact
native output, game paths, retries/reruns and source round trips are checked
across direct/installed library, CLI and browser/extracted-static hosts.
The later sample retains the same seven-move prefix, discontinuous12-to26 input
and35-jump/13-piece summary described below. This quoted-text review is not a
physical-typesetting facsimile or original-machine-file certification.

The description credits David Ahl at Digital Equipment Corp., Maynard. The
listing header reads `1CHECK 05:54 PM 25-JUN-73`, and the footer says READY.
Neither page explicitly identifies a computer, interpreter or version. Author,
company, timestamp, prompt shape and compatible syntax are attribution leads,
not proof of BASIC-PLUS, DECsystem-10 or a particular math package. Dialect status
therefore remains unverified. No complete source/dialect certification follows
from this label/formula review.

### Printed sample continuity and opening oracle

Read the sample's left column before its right column. Its first seven visible
moves are `1->19`, `2->20`, `3->21`, `8->22`, `16->30`, `24->38`, `64->46`.
Each is a legal diagonal jump from the shown opening board and removes one
piece. Independently applying the described checker rules gives 47, 46, 45, 44,
43, 42 and 41 pieces, matching the seven printed intermediate boards. After the
seventh move the board is, by rows from squares1-8 through57-64:

```text
00011110
10001100
11111100
11000101
11000111
11000111
11111101
11111110
```

The next visible input at the top of the right column is `12->26`. Square12 is
empty in the preceding board: the earlier `3->21` jump cleared it as a midpoint.
The intervening visible jumps do not refill it. That next printed jump therefore
cannot follow this prefix as an uninterrupted legal move. This establishes a
sample discontinuity; it does not establish why or how the sample was assembled.

The sample eventually reports **35 jumps and 13 remaining pieces**, a total
consistent with 48 initial pieces, but it does not supply a continuous input
history proving that outcome. Do not fabricate intervening moves, swap the
counters or use the visible sample alone as a complete replay oracle.

The bounded acceptance extension uses the unchanged one-byte-corrected fixture:
play those seven opening jumps, attempt 12->26, then enter0/NO. Assert every
opening board, one illegal move with no mutation, seven jumps/41 pieces and
normal END999. Run it through direct/installed ESM/CommonJS, CLI and actual
browser/extracted-static acceptance. Its output is native; this is a verified
opening-path oracle with an explicit sample gap, not historical certification.

### Construct evidence

| Used form                                      | BASIC-PLUS October 1972 evidence | Interpretation                                                                                                                  |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `M=0`, `A(J)=1`                                | Sections 3.2 and 3.6.2           | LET is optional; an indexed target is an array element.                                                                         |
| `DIM A(64)`                                    | Section 3.6.2                    | Bounds include element 0; numeric elements start at zero. DIM declarations are known before execution, even when written later. |
| `INPUT "JUMP FROM";F`                          | Section 3.3.3                    | A literal prompt followed by semicolon and a target is documented.                                                              |
| Adjacent text/number PRINT items               | Section 3.3.2                    | Distinct items can omit semicolons; numeric output has padding.                                                                 |
| `PRINT USING B$,J,...`                         | Section 10.4.1                   | Template expression, comma and formatted values; `##` fields right-justify the integers.                                        |
| `INT`, `ABS`, arithmetic, IF/GOTO and FOR/NEXT | Sections 2.5, 3.5, 3.6 and 3.7   | These elementary forms are documented. The game uses integer-valued indices on legal moves.                                     |

This establishes a **BASIC-PLUS-compatible first implementation target**, not
proof that the unknown original platform was BASIC-PLUS. DECsystem-10's reviewed
INPUT section does not establish this inline prompt form; do not infer it from
PRINT or transplant the INPUT grammar between the dialects.

### Behavioral oracle and remaining historical checks

Initial board: rows 1, 2, 7 and 8 contain eight pieces; rows 3 through 6 are
`11000011`. There are 48 pieces and 16 empty squares. Jump 1 to 2 is illegal and
must leave the board/count unchanged. Jump 1 to 19 is legal: square 1 and midpoint
10 become empty, square 19 gains a piece and 47 pieces remain after one jump.

A replay scenario supplies `1, 2, 1, 19, 0, MAYBE, YES, 0, NO` as successive INPUT
responses. The summaries are one jump/47 pieces, then zero jumps/48 pieces after
restarting. MAYBE repeats the YES/NO question. NO ends normally. Numbering is
1..64 in eight aligned rows; the piece board is also eight rows with separate
padded numeric cells. Exact output must use the chosen profile's format rules.

The original game does not fully validate negative or fractional square input.
Do not repair its move logic inside the interpreter. Invalid subscripts need a
source-located runtime error under the eventual documented profile rules. The
exact historical fractional-subscript conversion still needs stronger evidence;
this first oracle deliberately uses integral square numbers.

The corrected native path above executes these move/retry/replay checks with
native output spelling. The complete label/formula comparison and printed-sample
discontinuity are recorded above. Remaining: settle the unclear transcription/
edition details, certify the dialect and its exact output/subscript rules, and test
the remaining verified forms and input paths. No full historical compatibility
pass is recorded yet.

## 23MTCH

- Upstream file: `23mtch.bas`, pinned by the ledger's raw SHA-256.
- Listing and sample: printed page **227**, PDF page **229**, leaf **n228** of the
  [same scan](https://archive.org/details/101basiccomputer0000davi/page/n228/mode/1up).
- The printed sample explicitly identifies **EDUSYSTEM 30**. Upstream README's
  empty dialect field is not evidence of a generic or Microsoft dialect.
- The listing uses explicit LET, GO TO, RND(0), integer checks and semicolon PRINT.
  The scanned GO TO at line 340 is clear; source spacing varies elsewhere.

GO TO is an established spelling (Dartmouth Fourth Edition section 1.7.4 also
uses it). It can be introduced as an unambiguous native grammar extension without
claiming EduSystem compatibility or changing existing native numeric formatting.
The native name GO must remain available in LET/expressions; no globally reserved
GO keyword or arbitrary keyword splitting is necessary for this spelling.

### Reviewed output-layout difference

The complete printed listing and adjacent sample on page 227 were reinspected
from the same PDF identified above (one-based PDF page 229, leaf n228). The
downloaded PDF again has SHA-256
`c8a7549a649e9b6a99d80cab9ec8e3d78f6a872f127daee617fe692c40b92867`.
The catalog describes a 1974 book, while the pinned repository describes a 1975
third printing. The observation is therefore a reviewed difference between these
sources, not proof of an OCR error or of a defect in every edition.

At label **380**, the pinned transcription is:

```bas
380 PRINT "I TOOK";C;"..."
```

The printed listing has a **semicolon after the closing quote of the last item**.
That terminal separator is absent from the pinned line. The difference affects
whether the following output continues on the same line. The printed sample
corroborates the listing: after a computer turn, its `I TOOK` output and the next
`THERE ARE NOW` output share a physical line. The quoted spacing around the
ellipsis also differs visibly; no complete byte-identical transcription or
automatic correction is inferred from the typography.

This is sufficient for `sourceStatus: reviewed-difference`, with all source,
dialect, feature and behavioral blockers retained. It does not certify every
character in the listing or establish EduSystem's complete PRINT semantics.
The raw fixture remains the exact pinned 1,211 bytes / 44 physical lines with
SHA-256 `6406621c19cfac9961d0b4fa36ba50d322f4697648b1021fe99cace6ef9d8896`.
A separately named corrected fixture now applies only that terminal semicolon.
The original partial native regression below still exercises the unchanged
pinned transcription. The correction leaves every other byte, including quoted
spacing, intact; it is not a full scan-normalized transcription.

### Separately tested terminal-semicolon correction

`23mtch-corrected.bas` inserts exactly one ASCII semicolon before the newline at
label 380. Its 1,212 bytes have SHA-256
`6e20090bfdebc2f4760baa7568d53d6a64e18310f2f9daf6e95a883666956364`.
The original 1,211-byte fixture and its hash remain unchanged. The fixture README
retains attribution and archival provenance; no additional source, whitespace,
message or game logic is edited.

Both fixtures now have independently expected complete native output for the
seven-moves-of-one loss/replay path. The correction suppresses exactly six
newlines: for example `I TOOK1...THERE ARE NOW21MATCHES.` is one line rather than
two. Invalid human moves 0, 4, 1.5 and 24 reprompt without changing the 23-match
state. Computer choices remain 1, 3, 3, 3, 3, 3; remaining counts are 21, 17, 13,
9, 5, 1, followed by loss and replay at 23. EOF bounds the next round at label 230. Repeated runs reset state. Entering 2 still reaches the explicit native
RND(0) arity error at label 330 before any random callback.

The shared oracle runs through direct/installed ESM/CommonJS and real file CLI,
including editor LOAD/LIST/SAVE and portable file execution. Browser tests import
both sources, assert the entire transcript including submitted-input echoes,
then Stop, export exact bytes, reload and exercise the blocked branch. Those
cases also run against the extracted static archive. These are corrected/raw
native path checks, not EduSystem output/profile certification or a complete
historical-game pass. The full listing, exact quoted spacing, dialect numeric
and random rules, other game paths and final corpus acceptance remain open.

### Tested partial native path

Seven successive human moves of 1 produce computer moves `1,3,3,3,3,3`, leaving
21,17,13,9,5,1 after the computer turns. Taking the final match loses. The source
then jumps back to initialize M to 23 and asks for a new move. This path does not
execute RND(0), and is useful as an unchanged-source control-flow regression.

Direct and installed ESM/CommonJS acceptance execute this unchanged-source
loss/replay path and check every remaining-match count, computer move, result
and replay initialization. Browser automation imports the source, plays that
path, stops, reruns and observes the blocked branch. Native EOF bounds the
library observation at the next prompt without editing the game.

It is not a full compatibility pass: choosing 2 on the first turn reaches the
RND(0) branch, which the native runtime currently rejects for arity. Classic
numeric spacing also remains absent. Test/record the blocked branch as well as
the successful partial path; do not hide it by rewriting RND or removing code.
A certified EduSystem profile and complete game/formatting checks remain required.

### March 1975 listing and EDUSYSTEM-30 reference run

The [March 1975 third printing](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=227)
has the listing and sample together on printed and PDF page 227. The scan's
SHA-256 is `311c1be8d3c9361ee9badb59b5a43c43a5b0bf4803298943be1cb617b8f33ad7`.
Visual comparison accounts for all 44 statement labels and confirms the same
numeric expressions, input checks and branches. In particular, line 250 checks
for fractional input and line 320 uses `<>`; scan OCR misreads both.

The scan shows terminal semicolons at both 220 and 380. The pinned transcription
omits both; the existing one-byte correction covers 380. At 220 the semicolon
keeps the question on the same line as the `INPUT` question mark. A character-cell
review of all 14 quoted literals resolves the printed-text differences.

| Label | Difference from the 380-only correction                           |
| ----- | ----------------------------------------------------------------- |
| 110   | One space between the two sentences                               |
| 115   | No space after the comma in the choice list                       |
| 120   | No space after the ellipsis or after the comma in the choice list |
| 220   | Terminal semicolon before the `INPUT` at 230                      |
| 420   | Three exclamation marks after the result word                     |

The listing's three consecutive periods at 380 and punctuation at 450 agree
with the pinned text. The sample and OCR can visually suggest extra spaces there.
The separate `23mtch-mar75-text.bas` fixture applies only the table's changes to
the 380-only correction. It has 1,210 bytes, 44 physical lines and SHA-256
`6b4ce01cdd00a638a415801bd912f9cbfe8ae02d1e42c6b41e759246f1f94ecc`.
The preserved raw and 380-only fixture bytes remain intact. The sample supplies
game and layout evidence. The capture records terminal bytes for the archived
build.

The [January 1973 DEC handbook, §7-5](https://deramp.com/downloads/mfe_archive/011-Digital%20Equipment%20Corporation/00%20Digital%20Handbooks/08%20PDP-8%20Family/Edusystem%20Handbook/EduSystemHandbookJan73.pdf#page=293)
specifies a fresh random value on each `RND(X)` call, with a required dummy
argument whose value does not select the result. A new `RUN` starts the same
sequence unless the program uses `RANDOMIZE`. Line 330 multiplies the draw by
three, truncates it with `INT`, and adds one. The listing has no `RANDOMIZE`.

The [archived OS/8 DECtape](https://www.pdp8online.com/ftp/images/os8/edu30.tu56)
contains `EDU30.SV`. Booting it under SIMH PDP-8 produced an `EDUSYSTEM-30`
banner and confirmed that two `RUN`s produce the same first 12 draws. Varying
the argument from −2 to 9 produced the same sequence. A division-by-zero
argument reported `D0` before each draw and execution continued in this build.
That diagnostic is evidence for argument evaluation, separate from the literal
zero needed by 23MTCH.

| Printed round | Human inputs          | Computer moves  | Counts after computer moves | Result                                                               |
| ------------- | --------------------- | --------------- | --------------------------- | -------------------------------------------------------------------- |
| First         | `3, 1, 2, 1, 1, 0, 1` | `3, 3, 2, 3, 3` | `17, 13, 9, 5, 1`           | `0` retries at one match; the player takes the last match and loses. |
| Replay        | `2, 3, 3, 2, 1, 1`    | `1, 1, 2, 3, 3` | `20, 16, 11, 6, 2`          | The player leaves one match and wins; the next round resets to 23.   |

The first round makes zero RNG calls. The replay's five computer moves match
the first five draws in the reference run. A third-round probe, beyond the
printed sample, enters `2` and observes a computer move of `2`, leaving 19.
This uses the sixth draw in the same `RUN`; a seed reset at replay would have
produced a computer move of `1`. The capture stops at the next question because
the original source automatically starts another round after each result.

The [offline capture](edusystem30-reference.json) records the values, moves and
transcript hashes for the preserved 380-only fixture, its line-220-semicolon
probe and the reviewed March 1975 fixture. The three runs agree on game outcomes.
The line-220 probe isolates the joined prompt. To reproduce, install
`pexpect`, build the PDP-8 simulator from the capture's pinned SIMH commit, and
download the tape separately. The script verifies the tape and fixture hashes and boots
disposable writable tape copies because the interpreter needs scratch blocks.

```sh
python3 scripts/research/capture-edusystem30.py \
  --simulator /path/to/simh/BIN/pdp8 \
  --tape /path/to/edu30.tu56 \
  --output /tmp/edusystem30-reference.json
diff -u \
  <(python3 -m json.tool docs/edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/edusystem30-reference.json)
```

The [recovered RNG transition](edusystem30-rng.md) uses exact words from the
same archived build. The [bounded EDUSYSTEM-30 profile](edusystem30-profile.md)
matches the archived game transcript through library, CLI and browser. The
partial native path remains available for the raw and one-byte-corrected sources.

## LIFE2

### Pinned source and March 1975 review

Brian Wyvill is credited on printed page 147. The pinned upstream
[life2.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/life2.bas)
has 1,944 bytes and 79 physical lines, including its final unterminated line.
Its SHA-256 is `047474f16b61cac8e57fb573ef9c783c5c5eabe6f8eed13ac7bcee610f6a9dde`.

The description begins on printed page 146. The listing and sample run are on
printed page 148, PDF page 150 of the
[earlier scan](https://archive.org/details/101basiccomputer0000davi/page/n149/mode/1up)
and PDF page 148 of the
[March 1975 third printing](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=148).
The March 1975 PDF has SHA-256
`311c1be8d3c9361ee9badb59b5a43c43a5b0bf4803298943be1cb617b8f33ad7`.

The [reviewed fixture](../scripts/package/fixtures/classic/life2-mar75-reviewed.bas)
has 1,941 bytes, 79 physical lines and SHA-256
`7994b561062b02ba16c467350e83aff60c693659f94ab7b121d98a17ef728789`.
It preserves the pinned transcription's spacing outside the following edits.

| Labels                  | Reviewed difference                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| 13                      | Put the same eight neighbor-offset pairs in printed order.                                                     |
| 500                     | Remove the second period from the board title.                                                                 |
| 510, 511, 519, 535, 580 | Use the letter O in the five `TO` loop delimiters. The scan's digit zero has a different, slashed glyph.       |
| 574, 575                | Separate the result PRINT from `RUN` with a colon.                                                             |
| 575                     | Remove the leading space inside the winner literal.                                                            |
| 700                     | End the coordinate-label PRINT at its colon and separate the final `CHR$(13)` from indexed INPUT with a colon. |

The four-character mask at 700 is dark in the scan. The fixture retains the
pinned `@@@@` reading, the two carriage returns and the order of the indexed
INPUT targets. The source review leaves the original interpreter attribution
open. BASIC-PLUS is the upstream README's dialect hint.

### Printed board replay

The [sample fixture](../scripts/package/fixtures/classic/life2-sample.json)
contains the seven printed boards, beginning with the six opening pieces and
ending with Player 1's win. The input is masked in the scan, so the coordinate
sequence is a reconstruction. The [board test](../scripts/life2-sample.test.ts)
uses a separate five-by-five Life model to verify every printed board from
those coordinates. It accepts coordinates in column,row order, following the
listing's `INPUT Y(B),X(B)` and subsequent row-first array lookup.

The final turn selects the same empty coordinate for both players. Line 741
clears the cell one row and one column away. That cell is also empty in this
replay.

### RSTS V4A-12 MA2 reference run

A fresh [selected RSTS build](rsts-v4a-build.md) listed all 79 lines of the
reviewed fixture. It flagged `RUN` as an illegal verb at 574 and 575 during
entry. The exact listing still reached all seven printed boards, including the
same-coordinate message and final winning board. At the result branch it
reported an illegal statement at 575. A separate all-dead opening reached the
same error at 574.

A diagnostic variant substitutes `END` for `RUN` at only those two labels.
It reproduces the same boards and prints the Player 1 and draw results before
returning to Ready. The coordinate prompt emits the two mask strings with
carriage returns before the indexed input. An isolated execution of the exact
line 741 clears an occupied offset cell, preserves a separate occupied cell
and sets B to 99.

The [capture record](life2-rsts-reference.json) stores the observed boundaries
and transcript hashes. They omit the RUN command and its time header, normalize
CRLF to LF, and preserve standalone carriage returns, spacing and input echo.
The [capture script](../scripts/research/capture-life2-rsts.py) boots a disposable
copy of the raw RK05 disk before REFRESH. It compares LIST and the archived
boards to the committed fixtures. Run it with the pinned SIMH PDP-11 binary and
`pexpect` installed.

```sh
python3 scripts/research/capture-life2-rsts.py \
  --simulator /path/to/pdp11 --disk /path/to/uninitialized-rk05.dsk \
  --output /tmp/life2-rsts-reference.json
diff -u \
  <(python3 -m json.tool docs/life2-rsts-reference.json) \
  <(python3 -m json.tool /tmp/life2-rsts-reference.json)
```

This establishes behavior on the selected archive. LIFE2's original
interpreter and the printed in-program restart behavior still need evidence.

## Attribution and fixture policy

The [book's archival record](https://archive.org/details/101basiccomputer0000davi)
marks it Public Domain and links a report of Ahl's 2022 dedication. The upstream
repository has no license metadata. Those facts do not license unrelated modern
files or certify every contributor's source independently.

This first slice uses small attributed test fixtures, retains the raw bytes/hash
and identifies the book/page and any correction. Test fixtures are excluded from
npm production archives. Do not vendor all 108 files, manuals, modern adaptations
or upstream documentation under this repository's MIT license by assumption.
Before distributing any additional source, retain its actual provenance and
attribution evidence as part of #115. No scanned manual is bundled.

## Manual references

- [BASIC-PLUS Language Manual, October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
  reviewed using [archival OCR and PDF](https://archive.org/details/bitsavers_decpdp11rsDBASICPLUSLangManOct72_10455777).
- [DECsystem-10 BASIC Conversational Language Manual, March 1974](https://bitsavers.org/pdf/dec/pdp10/TOPS10_softwareNotebooks/vol06/DEC-10-LBLMA-A-D_BASIC_Conversational_Language_Manual_Mar74.pdf),
  especially sections 6.1/6.2, 8.6.4 and chapter 11.
- [Dartmouth BASIC Fourth Edition, January 1968](https://archive.org/details/bitsavers_dartmouthdition_3679804),
  sections 1.7.4 and 2.1. This is not evidence for later Dartmouth features.
