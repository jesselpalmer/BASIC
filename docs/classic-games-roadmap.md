# Classic-game compatibility roadmap

**Decision:** BASIC 1.0 is **not ready**. Correct classic game listings are a
release requirement under [release #109](https://github.com/jesselpalmer/BASIC/issues/109)
and [epic #114](https://github.com/jesselpalmer/BASIC/issues/114). This scope was
adopted October 24, 2026. A merged prerequisite does not by itself complete a
compatibility issue or approve a release.

## Current checkpoint

Reconciled against main `433c65bf34dced9bfc445697d5a937ff8c02b810` after
[PR #165](https://github.com/jesselpalmer/BASIC/pull/165). Native is still the
only executable profile. The merged native features and internal historical
conformance work below are useful progress; none of the compatibility parent
issues is complete.

The [structured ledger](classic-games-ledger.json) currently records:

| Evidence dimension            | Recorded state                                  | Meaning                                                                                                      |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Inventory                     | 108 pinned files                                | Complete byte/hash inventory, not complete source certification.                                             |
| Source review                 | 3 reviewed differences; 105 unresolved          | 1CHECK, 23MTCH and LIFE2 have specific scan-backed differences; this does not certify their entire listings. |
| Dialect review                | 1 printed-system identification; 107 unverified | 23MTCH's printed system is identified; no complete executable dialect/version is certified.                  |
| Behavior                      | 2 partial native paths; 106 not run             | 1CHECK's reviewed correction and 23MTCH's recorded path are distinct from full historical passes.            |
| Full historical compatibility | 0 certified passes                              | All 108 dispositions and required behavior remain release obligations.                                       |

Run `bun run check:corpus` when updating this checkpoint. Its fail-closed ledger
validator prevents unsupported certification/pass claims; it does not run games
or replace primary-source review. Counts above are separate evidence dimensions,
not percentages of release completion. Missing-book BUNNY/SNOOPY entries remain
separate from the 108-file denominator.

The merged [math-package provenance investigation](numeric-representation.md#implementation-evidence-and-version-boundaries)
identifies specific implementation leads and version pitfalls. It does not
resolve package-specific rounding or activate numeric execution. The
[1CHECK source review](classic-source-review.md#whole-listing-review-and-attribution-limits)
now covers all85 numbered lines and records unclear punctuation and a printed
sample discontinuity; source/dialect certification remains open.

The [reference-media verifier](rsts-reference-media.md) now pins tape one's
30 linked payloads, including all eight math variants and IN/OV, with an exact
input SHA and a read-only reproducible command. This is media identity, not a
linked/booted installation or numeric rounding evidence by itself. The follow-up
[selected MA2 build and probe](rsts-v4a-build.md) now records a linked/booted V4A-12
monitor, selected object/map identities and 42 repeatable conversion-byte/event
observations. Literal conversion and opposite-sign arithmetic differ from a
single generic rounding rule. Manual clock/startup and filesystem limitations
remain explicit; operation tracing and broader reference validation come next.

The linked [Google roadmap](https://docs.google.com/document/d/1onRiRqbrjoVH5w7ByZ_ylk_ZhixE3OqN-nPDYBHImdk)
and [implementation backlog](https://docs.google.com/document/d/1V02IrDkBeG98QwgzW1Rx6VgZe4eVkTmSfTdNCD3tUIA)
have also been reconciled through merged #164, preserving their earlier plans
as historical reference. This repository matrix and the owning issue criteria
track subsequent deliveries.

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
Those forms and native integer PRINT USING are now implemented. A separately
reviewed line-74 correction executes the scripted native path described below;
the raw listing still rejects its unsupported delimiter. This finding does not
certify every other character, input path or historical output rule in 1CHECK.

The delivered corrected native path prints 1..64 as eight aligned rows,
initializes 48 pieces and 16 central empty squares, rejects jump 1 to 2 without
changing state, accepts 1 to 19 while clearing square 10 and leaving 47 pieces,
quits with 0 and accurate counts, retries invalid replay answers and resets to
48 pieces on YES. Historical number spacing and dialect certification remain
blockers. Compare the original program's own invalid-input defects
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

## Delivery status and remaining work

All parent tickets below remain open. **Native** means executable through the
current shared parser/runtime. **Internal** means a tested conformance helper or
scanner seam with no public historical selection. Linked contracts define their
limits; issue/PR evidence retains individual validation runs.

| Area / parent tickets     | Delivered                                                                                                                                                                        | Required before completion                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source — #115             | All 108 hashes, structured ledger and validator; scan-backed 1CHECK/23MTCH/LIFE2 differences.                                                                                    | Complete listing/dialect/edition review, assets, redistribution evidence and independent behavior oracles.                                                    |
| Context — #116            | Native immutable API/AST context; [portable source envelopes](portable-documents.md) in browser drafts/import/export and CLI file execution; activation/name-resolution designs. | Executable historical support matrix, numeric/host observation contracts, historical selection and terminal editor persistence.                               |
| Lexing — #117             | Native optional LET/GO TO; [internal compact scanner](scanner-conformance.md), integer spelling and DATA source modes.                                                           | Shared historical parser/AST integration, remaining source-backed lexical forms/continuation and runtime activation.                                          |
| Arrays — #58              | [Native explicit numeric/string arrays](arrays.md), bounded allocation and detached observations.                                                                                | Profile defaults, subscript conversion, duplicate declarations and required ranks/forms.                                                                      |
| Output — #119/#120        | Native adjacency/integer USING; [internal integer/ASCII zone layout](print-layout-conformance.md).                                                                               | Historical float formatting, TAB/cursor/input interaction, margin rules and required USING masks/rounding.                                                    |
| Branches/calls — #118/#57 | Native colon sequences, inline IF/ELSE, literal GOSUB/RETURN and ON GOTO/GOSUB.                                                                                                  | Verified historical separators/transfers and GOTO expression OF; complete game outcomes.                                                                      |
| Input — #121              | [Native scalar/array target lists](input-targets.md), strict rows, retries and cancellation isolation.                                                                           | Historical prompts/continuation/surplus/conversion and line/file input.                                                                                       |
| Data — #122               | [Native typed pools/READ/RESTORE](data-statements.md); [internal historical text-field scanning](historical-data-scanner.md).                                                    | Historical pool/AST integration and target-dependent READ conversion; verified RESTORE forms. Missing AWARI data stays unresolved.                            |
| Numeric — #123            | Native scientific literals/powers and shared native signatures; internal historical signature inventory and [exact 24/56-bit word decoding](basic-plus-floating-words.md).       | Literal/intermediate rounding, package-specific arithmetic/intrinsics, defaults/RNG and numeric diagnostics. Decoder results are not executable BASIC values. |
| Integers/logical — #124   | [Internal signed-word operations](integer-semantics.md#internal-word-conformance-slice), raw integer spellings and bounded literal tokens.                                       | Numeric-kind AST/evaluation, mixed-mode scope, conversion/error edges, legal logical positions and operand ordering.                                          |
| Text — #59                | [Internal byte-string functions](string-conformance.md) and [padded string relations](string-relation-conformance.md).                                                           | Intrinsic/runtime integration, index/error edges, full character ordering, VAL/NUM$/CHANGE and game outcomes.                                                 |
| Functions — #125          | Name-resolution and numeric/result-kind designs.                                                                                                                                 | Expression/multiline DEF FN, parameters/scope, bounded frames, recursion policy and unwinding.                                                                |
| Loops — #126              | Native loop/call ownership retained; documented historical differences.                                                                                                          | Historical completion/reentry/transfers, required NEXT forms and modifiers with verified evaluation order.                                                    |
| MAT — #127                | Dependency observations in the corpus inventory.                                                                                                                                 | Verify and implement required forms, dimensions/aliasing and failure/input behavior.                                                                          |
| Services — #128           | Dependency observations and continued-error design requirements.                                                                                                                 | Bounded file/CHAIN/terminal/time capabilities, required assets and execution-owned trap/RESUME state.                                                         |
| Acceptance — #129/#109    | Native installed/types/CLI/browser/archive checks; fail-closed release completion/certificates.                                                                                  | Full historical gameplay/state/output/lifecycle acceptance, all corpus dispositions and a fresh approved exact candidate.                                     |

The [dialect design](dialect-design.md), [activation contract](profile-activation.md)
and [intrinsic-resolution contract](intrinsic-resolution.md) govern shared
parser/runtime integration. Keep native names, values, source positions and
ownership intact. Do not add a second evaluator, source-to-JavaScript eval,
filename heuristics, permissive merged grammar or automatic source corrections.
Freeze public closed AST/reserved-word/host contracts only after the required
profile decisions are settled.

## Next milestones

1. **Finish the first game's source/dialect review (#115).** Keep corrected
   1CHECK as the first-game candidate, verify its complete listing and intended
   dialect/version, and record exact historical board/summary/replay oracles.
   Do not assign BASIC-PLUS merely because some forms match its manual. Further
   source reviews can proceed independently of numeric implementation.
2. **Resolve the selected numeric reference contract (#116/#123, with #128).**
   Pin the target implementation/math-package configuration required by the
   slice and independently establish literal/operation rounding, range decisions,
   signed-zero/exceptional patterns and numeric event behavior. Review #161's
   provenance findings for the BASIC-PLUS candidate. The exact decoder can
   observe stored words; it cannot supply unknown rounding. Settle public value
   and observation boundaries for the chosen precision; a first supported
   configuration need not activate both formats. This evidence work can proceed
   alongside source certification, without assigning that dialect to a game.
3. **Integrate one useful historical vertical slice (#116/#117 and required
   feature owners).** Use the shared parser/runtime and an explicit support row
   for every accepted expression, statement and value kind. Resolve that slice's
   defaults, arrays, output and loop policies; reject unsupported forms before
   effects, including unreachable clauses and supplied trees. Internal helpers
   are prerequisites, not a reason to expose an incomplete profile.
4. **Deliver the first historical game across hosts (#129).** Verify direct and
   installed library, CLI/editor and browser import/run/input/export/reload,
   reruns/Stop/Step and exact extracted artifacts. Preserve native regressions
   and distinguish corrected-source results from raw-source results.
5. **Expand from verified corpus requirements, then review 1.0 (#114/#109).**
   Add remaining functions, modifiers, MAT and host dependencies from certified
   requirements; reconcile every file disposition. Only a fresh integrated
   candidate with the full acceptance evidence can change readiness.

Work on independently settled requirements may continue in focused PRs while
an unrelated evidence gap remains open. Prefer work that closes a milestone's
missing acceptance condition over accumulating disconnected helper modules.
Merge dependencies first, review the integrated tree and require green checks.
No issue-count or test-count target substitutes for these outcomes.

## Acceptance and roadmap upkeep

The corpus gate must verify behavior through direct library use, installed
ESM/CommonJS and public types, file/terminal CLI round trips, and actual browser
import/run/input/export/reload. Run the browser against the exact extracted
static distribution. Use deterministic input/random/clock, instruction/output/
allocation limits, real expected state/output and independent review. Include
complete game result/retry/replay paths and cross-feature/error/cancellation
coverage; parsing or reaching the first input is insufficient.

For each merged delivery, update its row above and the owning issue's remaining
criteria. Update ledger/source review records only when new source or behavior
evidence warrants it. Move a parent to complete only when all its acceptance
criteria are met; preserve corrected/raw and native/historical distinctions.
Recompute checkpoint counts from the ledger when those records change. Link the
current roadmap from #114 and #109 instead of treating old delivery comments as
a current plan.

All 108 dispositions must reconcile. No unresolved valid implementation, dialect
or external-dependency blocker may be hidden behind an issue closure or
percentage. Reviewed source-defect dispositions explain exceptions; corrected
passes stay separate. A valid-game exclusion requires explicit owner approval.

Prior native candidate `201b52422edc75c518703874a459b6a83eef5726` and its archives
are historical evidence only. After compatibility work, validate a new exact
SHA/tree and actual package/static bytes with fresh Linux/macOS checks, retaining
names/sizes/hashes/logs and review outcomes under #109. Only then may its actual
Release decision become READY. Publication remains separate.

Existing graphics, WAIT, keyboard, Pong and work-preservation checks remain
regressions. Immediate terminal convenience (#60), play-only export (#108),
sound, sprites, levels and networking remain optional unless source
certification shows a required dependency. There is no calendar commitment.

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
