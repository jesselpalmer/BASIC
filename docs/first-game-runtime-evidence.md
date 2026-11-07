# First-game BASIC-PLUS runtime evidence and activation matrix

**Status:** bounded reference observations for #115/#116/#126/#129; historical
activation remains blocked. The reviewed March1975 1CHECK text is a candidate
compatible program for the selected V4A-12 software MA2 experiment. Its original
interpreter/version remains unknown. This document does not relabel that
attribution or turn native game tests into a historical compatibility pass.
The [first-game milestone](first-game-milestone.md) tracks the active runnable
outcome, delivery order and acceptance checks; this document retains the detailed
reference evidence and semantic obligations.

## Reference experiment and capture

The [53-line authored probe](first-game-runtime-probe.bas),
[41-line normalized result body](first-game-runtime-output.txt) and
[observation record](first-game-runtime-observations.json) retain32 subscript
cases and six targeted floating-loop scenarios, plus the subscript driver loop.
LIST matched every stored source line exactly, and two final RUNs produced
identical result bodies. The source SHA-256 is
`87de0ccad7e02753b71e1d0a7a9cce49448546487ddc9bd730cc91f7bdf5b950`;
normalized output SHA-256 is
`4512d3b75372525bb8c70451d812d40b222e19a62c6e41802e8d04e067771d46`.

Use the hash-pinned [selected build](rsts-v4a-build.md), reconstructed from blank
DOS scratch disks with all eight recorded object/map/loader payloads identical.
This reconstruction's unrefreshed raw disk hash is recorded separately in JSON;
it differs from the earlier build's whole-disk hash. Do not substitute payload
identity for a claim that all disk metadata is byte-reproducible. Boot identification
was `RSTS V4A-12 V4A12MA2`. A separate raw RK05 copy was refreshed and started,
with the same manual clock-register adjustment, missing INIT CUSP and existing
save/filesystem limitation. This is not an I/O-complete/site-initialized reference
installation and cannot be a general terminal/file/RNG oracle.

The probe explicitly initializes cells A(0)..A(3) to10/20/30/40. READ supplies
simple decimal test values; output transports selected values and ERR/ERL.
Whole terminal/default/I/O policy is not inferred. Dynamic RUN headers and Ready
prompts are excluded, CRLF becomes LF, and trailing ASCII spaces are removed per
line. The two untrimmed LF result-body hashes also remain in JSON. This
normalization must not be reused as a historical PRINT acceptance oracle.

Reproduce with the separately obtained pinned machine/build, never a restored
saved guest state: follow the documented REFRESH/START and clock steps, enter
`NEW IDXLOP`, send the probe in small chunks while waiting for echo, compare LIST
with the exact source, then RUN twice. No OS binary/emulator is bundled or run
by normal project checks. The probe uses historical ON ERROR/RESUME and is not
advertised as an executable native example.

## Subscript facts and limits

The selected observations are consistent with **truncation toward zero**, rather
than nearest rounding or floor, for the tested fractional values:

| Source index spellings                                                    | Observation with A(0..3)=10/20/30/40 |
| ------------------------------------------------------------------------- | ------------------------------------ |
| `-1.5`, `-1.1`, `-1.`                                                     | Error55 at line70.                   |
| `-.9`, `-.51`, `-.5`, `-.49`, `-.1`, `0.`, `.1`, `.49`, `.5`, `.51`, `.9` | Cell0, value10.                      |
| `1.`, `1.49`, `1.5`, `1.51`, `1.9`                                        | Cell1, value20.                      |
| `2.`, `2.49`, `2.5`, `2.51`                                               | Cell2, value30.                      |
| `3.`, `3.49`, `3.5`                                                       | Cell3, value40.                      |
| `4.`, `4.1`, `32767.`, `-32768.`                                          | Error55 at line70.                   |
| `32768.`, `-32769.`                                                       | Error51 at line70.                   |

Every error is observed with an installed ON ERROR handler; it records ERR/ERL
then RESUMEs at NEXT80. There is no inferred untrapped replacement index or
successful array access after error51. Native rejects fractional indices and
has its own diagnostics; the selected internal array store now applies the
observed signed-word truncation for the bounded cases. These32 cases do not
prove every MA2 fraction, normalization boundary, rank/dimension limit or
error/unwind path. Profile integration still needs those tests rather than
applying a generic Math.floor or nearest-rounding policy.

## Floating-loop facts and limits

| Targeted scenario                              | Observed state                               |
| ---------------------------------------------- | -------------------------------------------- |
| J=1 TO3                                        | Body1,2,3; post-loop J=3.                    |
| J=3 TO1 STEP-1                                 | Body3,2,1; post-loop J=1.                    |
| Empty positive range3 TO1                      | No body; J=3.                                |
| Empty negative range1 TO3 STEP-1               | No body; J=1.                                |
| Body increments J once in addition to NEXT     | Body1,3; post-loop J=4.                      |
| Leave unfinished loop once, then GOTO its NEXT | Reentry succeeds; C=3 and J=3 at completion. |

The driver loop also ends with I=32 after its32 subscript cases. The modified
index case prevents an overbroad “always retain the last in-range value” rule:
its final J=4 is already outside1..3 before NEXT tries the final increment.
The observations support retaining the pre-increment value on these termination
paths. They do not establish all floating-rounding, body assignment, nested,
GOSUB/FN, repeated-entry, overflow or zero-step behavior. Native continues to
retain its incremented completion value and discard frames on loop exit.

## Concrete first-game inventory

The unchanged reviewed-text fixture is
`scripts/package/fixtures/classic/1check-mar75-text.bas`, SHA-256
`f4744d9a5e9c6aa8bd08375d743e2ab7800c68e3af4d8d1a495717a3e99894b4`.
Inventorying it with the current **native common-grammar parser** gives85 lines:

| Statement AST form                                |     Count |
| ------------------------------------------------- | --------: |
| PrintStatement                                    |        30 |
| LetStatement                                      |        14 |
| IfStatement                                       |        12 |
| ForStatement / NextStatement                      |     7 / 7 |
| GotoStatement                                     |         5 |
| RemStatement                                      |         4 |
| InputStatement                                    |         3 |
| DimStatement / PrintUsingStatement / EndStatement | 1 / 1 / 1 |

Expression inventory contains25 StringLiterals,66 NumberLiterals,72 Variables,
10 ArrayReferences,25 BinaryExpressions,12 Comparisons,4 CallExpressions and
4 GroupExpressions, plus one ArrayDeclaration. Arithmetic uses `+ - * /`;
comparisons use `= > <>`; the four intrinsic calls are two INT and two ABS.
This is an auditable inventory of the shared grammar, not historical parser or
semantic certification. It does not enable a profile or supply missing rules.

## Closed support matrix before activation

Every row below remains an **activation obligation**, including forms that look
identical to native syntax. Accepted values and effects must have historical
semantics together; a statement-name allowlist is insufficient.

| Required form / owner                                         | Evidence or current component                                                                                                                                                                                                  | Remaining activation condition                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Labels, short names, quotes, REM; tokenizer/parser/validation | Manual §§2.2/2.4/3.1/5.1.1; internal compact scanner and quote/comment tests.                                                                                                                                                  | Feed the shared parser explicitly; preserve raw spelling/physical spans and strict labels/names. Reject unsupported lexical forms without native fallback.                                                                      |
| Decimal literals; types/parser/numeric value owner            | MA2 captures, [literal/expression preparation](ma2-expression-parser.md), reviewed candidate parsing, shared scalar/array word storage and exact source-matched supplied candidate admission.                                  | Complete public execution-context preparation for every accepted statement; unsupported conversion statuses/events still need pre-effect policy.                                                                                |
| `+ - * /`, grouping, unary signs; evaluator/value owner       | Captured MA2 arithmetic through shared [scalar](ma2-scalar-storage.md) and [array expression](ma2-array-expressions.md) evaluation.                                                                                            | Bind the implemented word-preserving expression/storage operations to historical statements and complete source-located BASIC event policy. Never round only assignment/output or route a historical node to native arithmetic. |
| INT and ABS; intrinsic/evaluator owner                        | Merged [canonical MA2 INT/ABS](basic-plus-ma2-values.md), bound in the shared numeric expression driver; first game needs four calls.                                                                                          | Integrate existing numeric preflight/word operations with whole historical Program preparation and statement execution; no generic function/array fallback.                                                                     |
| LET, scalar/string state; evaluator                           | Shared [numeric scalar storage](ma2-scalar-storage.md), internal byte-string operations, selected assignments and A$/B$ replay through END.                                                                                    | Bind historical defaults, right-hand/index evaluation order and diagnostics to public Program execution; keep native semantics intact.                                                                                          |
| DIM A(64), A(...); declarations/arrays                        | Shared [MA2 array expressions](ma2-array-expressions.md), selected subscript conversion and exact 48-piece opening state.                                                                                                      | Complete historical error51/55, default/rank/bounds and repeated-run policies; do not infer an untrapped replacement from RESUME observations.                                                                                  |
| FOR/NEXT; control flow                                        | Manual §3.6.1 and six selected observations; merged #221 applies captured completion/reentry behavior. In review #227 checks nested unfinished reentry and rejects out-of-domain NEXT candidate increments before termination. | Settle general nested/call, historical overflow, error/reset/cancellation ownership and source budgets before public activation.                                                                                                |
| IF/GOTO; parser/dispatch/control flow                         | Twelve comparisons/five jumps; internal [numeric comparison source](ma2-source-comparisons.md) and shared padded-string predicate binding.                                                                                     | Bind exact numeric/string relations, real destinations and historical transfer policy. Preserve raw game behavior for invalid user moves; do not repair missing source guards.                                                  |
| PRINT adjacency/semicolon/blank line; output/runtime          | Parsed selected PRINT renders opening, move boards and summary; the seven-jump board has an independent expectation. In review #228 checks the exact transcript through quit, replay and a second result.                      | Verify terminal width, cursor and diagnostic interactions across public hosts with adequate independent evidence.                                                                                                               |
| PRINT USING B$; parser/formatter/preparation                  | The reviewed comma correction, source-bound B$ image and eight aligned numbered rows run internally; merged #222 checks bad images before effects.                                                                             | Complete error/order policy for every accepted path and reject unsupported dynamic historical formats before public activation.                                                                                                 |
| INPUT F/T/A$; input/evaluator/host boundary                   | Bounded, cancellable selected reads commit exact 0..64 MA2 values or printable replay text under the internal run; the game reaches END.                                                                                       | Settle broader row parsing, continuation/surplus/retry, byte encoding and event state for public host execution.                                                                                                                |
| YES/NO string relations                                       | Internal [padded string predicates](basic-plus-string-values.md) now use the shared comparison owner; native exact equality stays separate.                                                                                    | Integrate byte/trailing-blank semantics and input conversion together; preserve exact raw and corrected source distinctions.                                                                                                    |
| END, reruns, Step/Stop, errors and observations               | Internal selected sessions reach END and cancel pending INPUT; source and exact supplied trees check dead/later instructions before effects. No installed public profile exists.                                               | Keep public reset/cancellation and atomic source/context replacement; settle diagnostic/handler state and exact MA2 observations.                                                                                               |

The candidate identity/configuration must explicitly bind the selected MA2
precision/software configuration before activation; the existing design name
`basic-plus-1972-10` is not an accepted option today or evidence for every RSTS
math configuration. Canonical24-bit MA2 values fit exactly in binary64 as
observations, but that does not permit binary64 arithmetic or erase numeric kind,
word/status or diagnostic boundaries. MA4/noncanonical patterns remain separate.

The separate [conversion caller evidence](ma2-conversion-callers.md) records
VAL and floating/integer READ values, errors and post-handler cursor state.
It distinguishes error 52 conversion transfers from an isolated intermediate
error 48 and does not define INPUT rows, untrapped continuation or general I/O.
The source converter and caller observations do not yet bind complete historical
program execution; each support row above remains required.

A first supported slice can reject unsupported READ/DATA, integer `%`, MAT,
RND, additional intrinsics, GOSUB/FN, file/terminal services and other forms in
preflight. The authored reference probe itself uses READ/ON ERROR/RESUME for
measurement; it does not enlarge the first game's accepted subset. Valid but
unsupported programs remain corpus blockers, not exclusions from the release.

## Delivery order and acceptance

1. Reuse the implemented raw-literal, word arithmetic, INT/ABS, numeric relations,
   scalar/array expressions and string-value components. Close the remaining
   event/observation and accepted-language contracts identified by the
   [first-game milestone](first-game-milestone.md).
2. Connect selected INPUT to a resumable shared runner and complete the
   remaining defaults, string, loop, output and event policies above. Keep the public historical option rejected
   until every accepted row is complete; reject supplied unsupported trees and
   unreachable clauses before host effects.
3. Run the selected candidate through direct/installed ESM/CommonJS, CLI/editor
   and actual browser import/run/input/export/reload, fresh runs, Step/Stop and
   exact archive checks. Include illegal/fractional/out-of-range input, retry,
   replay, numeric events and work-preservation cases. Preserve source defects;
   never invent moves to fill the printed sample discontinuity.

The full108-file requirement, unresolved original game attribution and zero
certified historical-game passes remain unchanged. Native behavior remains the
only public execution contract. This document replaces neither the broader
[activation contract](profile-activation.md) nor the owning issue acceptance.

The [shared value integration contract](ma2-shared-value-contract.md) now defines
how the next literal/word/storage/observation stage fits the existing owners.
It does not complete any support row or enable the candidate configuration.
