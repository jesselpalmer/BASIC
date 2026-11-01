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

Two separate fixtures retain the pinned raw bytes and the reviewed one-character
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
- The scan's catalog year is 1974; upstream describes a 1975 third printing.
  Do not assert identical editions or call every difference an OCR error.
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

| Labels  | Reviewed agreement / remaining uncertainty                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5-68    | Instruction text, numbered-board introduction and DIM A(64) are present. Quoted spacing/punctuation is not certified byte for byte.                                                                               |
| 70-98   | Numbering loop, array initialization, central clearing loops, M=0 and GOTO 340 agree. Line72's format spacing differs; line74's comma difference remains the sole applied correction.                             |
| 100-112 | F/T input and the zero-to-summary branch agree. The line110 prompt separator is comma-like in this scan; its upper dot is not sufficiently clear to assert a further correction.                                  |
| 118-290 | Coordinate arithmetic, range/diagonal/occupancy checks, illegal-move branch and three-cell update/M increment agree in readable text. Quoted illegal-move spacing remains outside a lossless transcription claim. |
| 310-410 | Eight-row nested printing loops and return to input agree. Line360's final separator is comma-like; faint-dot uncertainty prevents certifying it as a change from the fixture's semicolon.                        |
| 490-999 | Sum, M/S summary operands, YES/NO branches and END agree. Line562's prompt separator and literal spacing/punctuation in550/580/610 need a clearer source before a full transcription is claimed.                  |

The uncertain separators at 110/360/562 must not be changed from a comma-like
scan glyph alone. A cleaner independent reproduction or the original machine
file is needed to distinguish a comma from a semicolon with a faint upper dot.
The current corrected fixture still changes **only line74**; it is not a fully
scan-normalized edition and does not resolve these observations.

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

## LIFE2

### Reviewed loop-delimiter differences

- Pinned file: [life2.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/life2.bas).
- Raw SHA-256: `047474f16b61cac8e57fb573ef9c783c5c5eabe6f8eed13ac7bcee610f6a9dde`;
  1,944 bytes and 79 physical lines, including the final unterminated line.
- The description begins on printed page 146. The listing and sample run are
  on printed page **148**, one-based PDF page **150**, leaf **n149** of the
  [available book scan](https://archive.org/details/101basiccomputer0000davi/page/n149/mode/1up).
- The downloaded PDF has SHA-256
  `c8a7549a649e9b6a99d80cab9ec8e3d78f6a872f127daee617fe692c40b92867`.
  Its catalog describes 1974, while the pinned repository describes a 1975 third
  printing. Record the difference without asserting identical editions or its
  transcription/OCR cause.

At labels **510/511**, physical lines **44/45**, the pinned text is:

```bas
510 FORJ=1T05
511 FORK=1T05
```

The visually inspected printed listing instead reads:

```bas
510 FORJ=1TO5
511 FORK=1TO5
```

Each delimiter's second character is the letter **O** in the scan and the digit
**0** in the pinned source. The nearby printed assignment zeros use a visibly
different slashed-zero glyph. This source comparison, rather than a parser
rejection, establishes reviewed differences at those locations. It does not
certify every other character, repair other loops, or establish the exact
original dialect: the README's BASIC-PLUS hint remains unverified.

The ledger retains the unmodified raw identity and all source, dialect, feature,
and behavioral blockers. No corrected LIFE2 fixture or game pass is introduced.
The existing conditional feature probe remains a separately authored excerpt;
it is not evidence that this complete listing executes correctly.

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
