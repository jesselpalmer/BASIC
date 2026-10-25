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

### Behavioral oracle, not yet executed

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

Remaining: review the rest of the transcription/edition differences, implement
the verified features, test legal/illegal inputs, real output, replay, cancellation
and all distribution surfaces. No compatible-source pass is recorded yet.

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
