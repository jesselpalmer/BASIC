# Classic-game compatibility roadmap

**Decision, October 24, 2026:** BASIC 1.0 is **not ready**. Correct classic game
listings are now a release requirement. This supersedes the earlier small-dialect
release boundary; it does not claim that the planned features work today.
[Release #109](https://github.com/jesselpalmer/BASIC/issues/109) owns the actual
readiness decision and candidate evidence; [epic #114](https://github.com/jesselpalmer/BASIC/issues/114)
owns this work. No interpreter implementation is part of this planning change.

## Compatibility target

The target is the complete pinned [101 BASIC Computer Games corpus](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/tree/45f75052be3f436f2e575f58d4aa611484268227):
**108 `.bas` files** at commit `45f75052be3f436f2e575f58d4aa611484268227`.
This is the earlier DEC anthology, not the later Microsoft-oriented _BASIC
Computer Games_. The maintainer describes a 1975 third printing, several DEC
and EduSystem dialects, Dartmouth and HP-like programs, and uncertain assignments.
Its README's dialect labels are research leads, not certified facts.

Every verified correct listing must run with its documented semantics through
the Bun library, installed CLI and browser. Valid but unimplemented dialects,
unknown syntax and unresolved external dependencies remain blockers. An explicit
owner decision in #109 is required to narrow that scope; an implementation's
limitations cannot be used as evidence that a program is invalid.

The [initial inventory](classic-games-inventory.md) records every file's hash and
first reported native-parser diagnostic. Against prior candidate
`201b52422edc75c518703874a459b6a83eef5726`, none of the 108 raw files parses
successfully. This is a baseline of missing compatibility, not a validity audit
or a behavioral test. No listing has been certified as fully compatible.

## What the original syntax means

There is no single historical BASIC grammar. Use the manual for the verified
profile/version, not whichever interpreter happens to accept an example.

| Construct                             | Primary evidence                                                             | Consequence                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Omitted `LET`, such as `M=0`          | BASIC-PLUS October 1972, section 3.2; DECsystem-10 March 1974, section 1.4.1 | Valid syntax in those dialects; now accepted for native scalar and explicitly declared array assignments.           |
| Adjacent PRINT text and numeric items | BASIC-PLUS section 3.3.2; DECsystem-10 section 6.1                           | The original summary need not be rewritten with semicolons; numeric padding is also part of output behavior.        |
| `DIM A(64)` and `A(I)`                | BASIC-PLUS section 3.6.2; Dartmouth Fourth Edition sections 1.4/1.7.8        | Arrays are ordinary historical syntax; multidimensional examples also need support.                                 |
| Compact spacing and `GO TO`           | Dartmouth Fourth Edition, printed page 5 and section 1.7.4                   | `10READA,B` and spaced keywords need profile-aware lexing, not fuzzy corrections.                                   |
| Bare `RND` and `RND(X)`               | BASIC-PLUS section 3.7.1                                                     | The argument is ignored in that dialect; do not assume Microsoft seeding conventions.                               |
| `RIGHT(A$,n)` versus `RIGHT$(A$,n)`   | BASIC-PLUS table 5-3; DECsystem-10 section 8.6                               | BASIC-PLUS's RIGHT starts at position n; DECsystem-10's RIGHT$ takes a count. They cannot be unconditional aliases. |
| `PRINT USING`                         | BASIC-PLUS section 10.4.1; DECsystem-10 chapter 11                           | Formatting is supported historical syntax, with dialect-specific masks and delimiters.                              |

These references establish constructs, not the complete dialect or correctness
of any individual listing. Expression precedence, implicit initialization,
integer widths/conversions, array namespaces/bounds, loop transfers, logical
truth and output cursor rules must also be settled before implementation.

### A verified 1CHECK transcription difference

The linked [book scan](https://archive.org/details/101basiccomputer0000davi/page/n165/mode/1up),
**printed page 164 / PDF page 166 / leaf n165**, visibly shows a comma after B$
in line 74:

```bas
74 PRINT USING B$,J,J+1,J+2,J+3,J+4,J+5,J+6,J+7
```

The pinned repository and pasted program instead have a semicolon after B$.
Both reviewed DEC manuals specify a comma between the template and item list.
Keep the raw transcription, and record this one-character correction separately;
do not invent an undocumented DEC syntax exception. A semicolon may be accepted
in another profile only with that dialect's own evidence. The scan is cataloged
1974 while the repository describes a 1975 printing; retain that edition
provenance and check the remainder of the listing in #115.

The original listing also has optional LET, arrays and adjacent PRINT items.
Fixing line 74 alone does not make it executable in the current interpreter.
This finding does not certify every other character or input path in 1CHECK.

First behavioral slice, after source certification: print 1..64 as eight aligned
rows; initialize 48 pieces and 16 central empty squares; reject jump 1 to 2
without changing state; accept 1 to 19, clearing square 10 and leaving 47 pieces;
quit with 0 and show accurate counts; retry invalid replay answers; YES starts
again with 48 pieces. Compare the original program's own invalid-input defects
with runtime bounds errors instead of silently changing game logic.

## Source defects and unresolved dependencies

Upstream NOTES explicitly warns about changed comparison operators, labels,
spacing, separators and string contents from OCR. It also documents missing
AWARI data, CANAM O$/Q$ uncertainty, and estimated BOAT/BULL content. BUNNY and
SNOOPY have no code in the book/collection and are separate from the 108-file
ledger. Some files are helpers or companion programs rather than standalone games.

Each file needs raw bytes/hash, book page/edition, verified dialect/manual,
feature dependencies, validity status and behavioral oracles. Classifications
are: verified pass, valid but unimplemented, evidenced source defect, unresolved
external dependency, or unresolved source/dialect. A verified correction carries
a minimal before/after patch and scan/manual evidence, with its results separate
from unchanged-source passes. A failing program is never a blanket test skip.

ANIMAL persistence, DOGS record files, Monopoly's file-backed arrays, keyboard
channels, and CHAIN companions/menu programs need explicit host/asset contracts.
A missing DEMON menu is not invalid syntax and cannot silently become END. The
browser must use bounded supplied capabilities; no automatic access to the host's
filesystem or process. Provenance/redistribution evidence must be recorded before
full third-party fixtures are bundled; upstream repository metadata has no license,
while the linked book scan marks public-domain status. These are distinct sources.

## Source and design records

The [structured ledger](classic-games-ledger.json),
[source review records](classic-source-review.md), and
[dialect design](dialect-design.md) track the current evidence and decisions.
All 108 files remain in scope. A verified construct may be implemented after its
own source/design gate is settled; unrelated unresolved programs remain release
blockers. Do not require an unsupported interpreter to certify its own inputs.
Native optional LET and GO TO are the first unambiguous grammar extensions;
historical semantic changes still require explicit verified profiles.
The core now carries explicit native dialect metadata through parsed Lines,
Programs, prepared snapshots and immutable runtime/evaluator selections. Unsupported
context fails before effects, and legacy trees remain native. Historical profile
semantics and terminal/browser document persistence are still open in #116.
The [explicit native array slice](arrays.md) in #58 now provides real board
storage with preflight allocation checks. It does not activate a historical
profile or complete 1CHECK's formatting and compatibility gates.
String-involved native PRINT adjacency (#119) and
[single-pass native integer PRINT USING](print-using.md) (#120) are implemented. Expressions
remain greedy, ordinary names/spacing retain their meaning, and unsettled
historical formatting policies remain explicit blockers. These contracts are
recorded before their implementation; each slice gets its own validated PR.
The raw 1CHECK listing remains unchanged and rejects its unsupported template
delimiter. A separately reviewed one-character correction executes a full native
scripted path with exact numbered/piece boards, illegal/legal moves, retry/replay
and normal exit. Historical number spacing and dialect certification still block
a complete compatibility pass; the full 108-file scope is unchanged.

The [native numeric expression slice](numeric-expressions.md) for #123 adds
scientific literals and powers using the documented arithmetic grouping while
retaining native finite doubles. Extracted formula tests do not certify whole
games. Historical intrinsic names, defaults, RNG and profile precision remain
open; existing SQR/EXP scalar and array names are preserved.

The [native statement/instruction slice](statement-sequences.md) for #118 adds
colon sequences with physical statement positions, same-line loops, line-entry
jumps and source-backed false-IF line scope. Inline THEN/ELSE, historical
backslashes/modifiers remain separate work; literal calls use the subroutine
slice below. AWARI sequence
probes explicitly add native keyword whitespace and are not whole-game passes.

The [native literal subroutine slice](subroutines.md) for #57 adds contextual
GOSUB/RETURN with real return positions, shared values, owned caller/callee loop
contexts and a bounded call stack. Existing names remain available. Computed
dispatch, historical transfer policies and full game/corpus outcomes stay open.
The normalized AWARI call probe is not a whole-game or unchanged-source pass.

## Delivery order and tickets

All listed feature tickets are P1 / High release blockers when required by the
certified corpus. #57-#59 are promoted and expanded existing issues, not duplicates.

| Phase                      | Tickets                                                                                                                                                                                                                              | Outcome                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1. Source certification    | [#115](https://github.com/jesselpalmer/BASIC/issues/115)                                                                                                                                                                             | Full corpus ledger, scan/manual evidence, corrections, assets and oracles.                                                  |
| 2. Dialect/API design      | [#116](https://github.com/jesselpalmer/BASIC/issues/116)                                                                                                                                                                             | Explicit selection across parser/runtime/library/CLI/browser; preserve current native semantics and source fidelity.        |
| 3. First game              | [#117](https://github.com/jesselpalmer/BASIC/issues/117), [#58](https://github.com/jesselpalmer/BASIC/issues/58), [#119](https://github.com/jesselpalmer/BASIC/issues/119), [#120](https://github.com/jesselpalmer/BASIC/issues/120) | Verified lexical forms/optional LET, arrays, PRINT and USING; complete 1CHECK behavior.                                     |
| 4. Control flow            | [#118](https://github.com/jesselpalmer/BASIC/issues/118), [#57](https://github.com/jesselpalmer/BASIC/issues/57), [#126](https://github.com/jesselpalmer/BASIC/issues/126)                                                           | Multiple statements, IF/ELSE line scope, subroutines/computed dispatch, loop transfers/modifiers.                           |
| 5. Input and data          | [#121](https://github.com/jesselpalmer/BASIC/issues/121), [#122](https://github.com/jesselpalmer/BASIC/issues/122)                                                                                                                   | Input lists/line input/array targets and DATA/READ/RESTORE.                                                                 |
| 6. Expressions and text    | [#123](https://github.com/jesselpalmer/BASIC/issues/123), [#124](https://github.com/jesselpalmer/BASIC/issues/124), [#59](https://github.com/jesselpalmer/BASIC/issues/59), [#125](https://github.com/jesselpalmer/BASIC/issues/125) | Math/defaults/randomness, integers/logical rules, dialect-correct strings/CHANGE and DEF FN bodies.                         |
| 7. Advanced dependencies   | [#127](https://github.com/jesselpalmer/BASIC/issues/127), [#128](https://github.com/jesselpalmer/BASIC/issues/128)                                                                                                                   | Required MAT forms and bounded file/CHAIN/error/time/terminal services. Split further from the certified dependency matrix. |
| 8. Distribution acceptance | [#129](https://github.com/jesselpalmer/BASIC/issues/129), [#109](https://github.com/jesselpalmer/BASIC/issues/109)                                                                                                                   | Meaningful corpus behavior, review, exact new candidate/artifacts and fresh Linux/macOS evidence.                           |

Research and design come first. A single shared parser/runtime should implement
verified profiles; no source-to-JavaScript eval, second evaluator, filename hacks
or permissive merged grammar. Retain original text/locations and native rejection
rules. Profile persistence with saved/imported source and prepared programs must
be designed before feature code; it is not implemented today.

After #116, independent expression/string/output areas may proceed in separate
PRs with explicit ownership. #118 changes shared AST/instruction positioning;
integrate it before dependent calls/functions/loop work. Keep PRs small, merge
dependencies first, review the integrated tree and require green checks. Do not
freeze the public closed AST/reserved-word/host contract before these decisions.

## Release evidence

The corpus gate must verify behavior through direct library use, installed
ESM/CommonJS and public types, file/terminal CLI round trips, and actual browser
import/run/input/export/reload. Run the browser against the exact extracted
static distribution. Use deterministic input/random/clock, instruction/output/
allocation limits, real expected state/output and independent review. Include
complete game result/retry/replay paths and cross-feature/error/cancellation
coverage; parsing or reaching the first input is insufficient.

All 108 file dispositions must reconcile. No unresolved valid implementation,
dialect or external-dependency blockers may be hidden behind an issue closure or
percentage. Reviewed source-defect dispositions explain exceptions; corrected
passes stay separate. A valid-game exclusion requires explicit owner approval.

Prior native candidate `201b52422edc75c518703874a459b6a83eef5726` and its archives
are historical evidence only. They must not be published as 1.0 under this scope.
After compatibility work, validate a new exact SHA/tree and actual package/static
bytes with green Linux/macOS checks, record names/sizes/hashes/logs and review
blockers in #109. Only then may its actual Release decision become READY.
Publication remains separate; no tag, package or release is created by this plan.

Existing graphics, WAIT, keyboard, Pong and work-preservation checks remain
regressions. Immediate terminal convenience (#60), play-only export (#108), sound,
sprites, levels and networking remain optional unless source certification shows
a required dependency. There is no calendar commitment.

## Primary references and provenance

- [Pinned corpus README](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/README.md)
  and [NOTES](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/NOTES.md).
- Digital Equipment Corporation, [BASIC-PLUS Language Manual, October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf).
  A [second archival copy](https://archive.org/details/bitsavers_decpdp11rsDBASICPLUSLangManOct72_10455777)
  supplied OCR and the scanned PDF for this review; PDF SHA-256
  `684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
- Digital Equipment Corporation, [BASIC Conversational Language Manual, March 1974](https://bitsavers.org/pdf/dec/pdp10/TOPS10_softwareNotebooks/vol06/DEC-10-LBLMA-A-D_BASIC_Conversational_Language_Manual_Mar74.pdf).
  Reviewed the [archived manual's OCR](https://archive.org/details/bitsavers_decpdp10TOksvol06DEC10LBLMAADBASICConversationalLa_5536882),
  including the versioned section dates retained in that manual.
- Kemeny and Kurtz, [Dartmouth BASIC Fourth Edition, January 1968](https://retrofun.pl/wp-content/uploads/sites/2/2023/11/BASIC_4th_Edition_Jan68_text.pdf),
  plus [archival text](https://archive.org/details/bitsavers_dartmouthdition_3679804).
  This edition establishes the cited constructs; later Dartmouth features still
  require the correct later manual, not an assumption based on 1968.
- David Ahl, [101 BASIC Computer Games scan](https://archive.org/details/101basiccomputer0000davi),
  cataloged 1974, printed page 164 for 1CHECK. Downloaded PDF SHA-256
  `c8a7549a649e9b6a99d80cab9ec8e3d78f6a872f127daee617fe692c40b92867`.
- [HP 2000E BASIC Reference Manual, August 1972](https://www.mrynet.com/FTP/os/HP2000/pdf/2000E_UsersMan.pdf)
  is a retrieved scan for follow-up HP verification, not certification that BATTLE
  or BUG belongs to that exact version. EduSystem, later Dartmouth and other
  uncertain mappings remain work for #115.
