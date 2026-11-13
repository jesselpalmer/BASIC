# Classic-game compatibility roadmap

Native BASIC and three bounded public profile families run today. The selected
profiles run 38 listings through the library, CLI/editor and browser. The
[EDUSYSTEM-30 profile](edusystem30-profile.md) identifies the adapted listings.
The [reviewed March 1975 1CHECK text](1check-reviewed-text.md) runs to END
under explicit selection through the library, portable CLI/editor and
[browser playground](https://basic-playground-rho.vercel.app/). Choose
**1CHECK · BASIC-PLUS selected profile** in the normal editor to edit and play it.
This establishes selected-configuration behavior; the original interpreter
and version remain unknown.

The [reviewed March 1975 23MTCH text](edusystem30-profile.md) matches the
archived EDUSYSTEM-30 transcript through the library, portable CLI/editor and
browser. Choose **23MTCH · EDUSYSTEM-30 selected profile** in the normal editor.

Record independent and user acceptance of 23MTCH under #129.
The [reviewed LIFE2 listing](altair-life2-profile.md) matches the archived
Altair 8K BASIC win, draw, restarts and coordinate retries through the library,
portable CLI/editor and browser. Choose **LIFE2 · Altair 8K BASIC selected profile**
in the normal editor. The [DECUS edition](classic-source-review.md#decus-basic-plus-edition)
has a verified RSTS BASIC-PLUS replay. Attribution for Wyvill's submission and
the book listing remains under #115. The [annotated second sample](classic-source-review.md#annotated-page-149-replay)
adds the Rubout echo and Player 2 win as checks for other candidate systems.
Independent and user acceptance remain under #129.
The [1CHECK](first-game-milestone.md) delegated Chrome playthrough is recorded
in #129. Jesse's personal acceptance and 1CHECK's original interpreter
attribution remain separate checkpoints.

The [reviewed LETTER listing](classic-source-review.md#letter) runs under the
existing EDUSYSTEM-30 profile. Choose **LETTER · EDUSYSTEM-30 selected profile**
in the editor and submit one uppercase letter per guess. Library and browser
acceptance match two archived rounds, including clues, the bell and automatic
replay. Installed CLI acceptance plays with fresh entropy.

The [reviewed TRAP listing](classic-source-review.md#trap) adds paired numeric
INPUT and literal subroutine calls to EDUSYSTEM-30. Choose **TRAP · EDUSYSTEM-30
selected profile** in the playground. Enter two bounds separated by a comma,
such as `20,40`. An exact guess uses the same number twice. The library,
portable CLI/editor and browser match the archived win, six-guess loss and
automatic replay.

The [reviewed LITQZ listing](classic-source-review.md#litqz) adds `STOP` to
EDUSYSTEM-30. Choose **LITQZ · EDUSYSTEM-30 selected profile** in the playground
and enter one answer from 1 to 4 for each of the four questions. The library,
portable CLI/editor and browser match all three archived endings. Select Run
again for a fresh quiz.

The [reviewed MATHD listing](classic-source-review.md#mathd) rolls two printed
dice and asks for their sum. The archive replay covers every face, a correct
answer, a retry and an answer reveal. Choose **MATHD · EDUSYSTEM-30 selected
profile** in the playground and use Stop to end the drill.

The [reviewed NUMBER listing](number-edusystem30.md) accepts guesses from 1 to
5 and awards points and jackpots. Both archived games, including the printed
716-point win, match the library, CLI/editor and browser. Choose
**NUMBER · EDUSYSTEM-30 selected profile** to play.

The [reviewed STARS listing](stars-edusystem30.md) gives one to seven stars
as clues to a hidden number. Choose **STARS · EDUSYSTEM-30 selected profile**
and guess a number from 1 to 100. The archive replay covers all seven clue
lengths, a loss, a replay win and a fresh run.

The [reviewed HURKLE listing](hurkle-edusystem30.md) uses compass clues to
locate a creature hiding on a 10-by-10 grid. Choose **HURKLE · EDUSYSTEM-30
selected profile** and enter pairs such as `5,5`. The archived replay covers
the printed opening win, compass clues, a five-guess loss,
automatic replay and a fresh run.

The [reviewed CHANGE listing](change-edusystem30-review.md) matches ten
archived receipts across the library, CLI/editor and browser. Choose
**CHANGE · EDUSYSTEM-30 selected profile** and enter a cost and payment.
The selected profile reproduces equal payment, shortage, and denomination
differences even when two sales display the same change total. The underlying
models match 180 decimal inputs, four arithmetic operations for each of 57
operand pairs, and 281 archived [numeric PRINT fields](edusystem30-print.md).

The [reviewed CHEMST listing](chemst-edusystem30.md) asks players to dilute a
fictional acid within a five-percent tolerance. Choose **CHEMST · EDUSYSTEM-30
selected profile** and enter `26` for the first dilution. The archive replay
covers the input retry, two successes, the ninth miss and a fresh run.

The [DIAMND review](diamnd-edusystem30-review.md) verifies the source correction
and traces a compiled constant mismatch on archived EDU30.SV. The original
run loads `1` for `60` and skips the outer loop. Restoring four constant triples
in the simulator produces the expected pattern at sizes 5, 15, and 31.
The selected profile now reproduces all three repaired transcripts across
the library, CLI/editor and browser. Choose **DIAMND · EDUSYSTEM-30 selected
profile** and enter an odd size from 5 to 31.

The [reviewed BATNUM listing](batnum-edusystem30.md) reproduces the three
printed games and a separate fresh run with rejected settings, an illegal
move, and a forfeit. Choose **BATNUM · EDUSYSTEM-30 selected profile** to
play the pile-removal game.

The [reviewed EVEN listing](even-edusystem30.md) reproduces the printed
computer win, a winning replay, and a fresh computer-first game with invalid
moves. Choose **EVEN · EDUSYSTEM-30 selected profile**. Take one to four
marbles per turn and try to finish with an even total.

The [reviewed ROCKET listing](rocket-edusystem30.md) reproduces the printed
lunar landing and a fresh zero-burn crash, with automatic restart after both.
Choose **ROCKET · EDUSYSTEM-30 selected profile** and enter a burn rate from
0 to 200 at each prompt.

The [reviewed BOUNCE listing](bounce-edusystem30.md) reproduces the printed
bouncing-ball plot and a replay with different parameters. Choose
**BOUNCE · EDUSYSTEM-30 selected profile** and enter `.1`, `30`, and `.9`
for the printed plot.

The [KINEMA adaptation](kinema-edusystem30.md) reproduces the archived
answer scoring and repeated problems. Choose **KINEMA · EDUSYSTEM-30
adaptation**. The archive rejects the printed line 508. The runnable source
expands that line to a quoted PRINT and preserves the printed fixture separately.

The reviewed [GOLF](golf-edusystem30.md) and [BLKJAK](blkjak-edusystem30-review.md)
listings run through the library, CLI/editor and browser with EDUSYSTEM-30 MARK
input. GOLF verifies two-player scoring, traps and water. BLKJAK verifies wager
retries, wins, replay and bankroll summaries.

The reviewed [CHOMP](chomp-edusystem30.md) and
[MUGWUMP](mugwump-edusystem30.md) listings match archived boards and complete
rounds. CHOMP covers the printed cookie sequence, invalid moves and replay.
MUGWUMP covers a six-turn win, a ten-turn loss and a fresh RUN. The book's
MUGWUMP listing identifies its RSTS/E conversion.

The [GOMOKO adaptation](gomoko-edusystem30-review.md) adds the explicit 19×19
board declaration to run on the archive. The
[AMAZIN adaptation](amazin-edusystem30.md) uses the book's smaller-memory
approach and reproduces two seeded archived mazes. The
[DIGITS review](digits-source-review.md) records archive rejection of the
printed matrix statements and bare `RND`.

The [BUZZWD adaptation](buzzwd-edusystem30.md) matches eight printed phrases
and the farewell, with three-field INPUT retries verified on the archive.
The [TOWER MARK adaptation](tower-edusystem30-review.md) matches the printed
three-disk solution, a two-disk replay and move retries. The unchanged
[3DPLOT listing](3dplot-edusystem30.md) matches all 41 archived plot rows.

The [NICOMA review](nicoma-source-review.md) reproduces four printed rounds
in archived RSTS V04B-17 BASIC-PLUS and records the EDUSYSTEM-30 rejections.
The original interpreter and the project's selected-profile path remain open.
The [recovered OMSI library](basbal-edusystem30-review.md#recovered-demonstration-library)
contains BASBAL, BASBL1 and the DEMON menu. With a second copy of the pinned
tape mounted on DT1, stock EDU30.SV runs the full menu, baseball game and
return to the menu. The public MARK profile replays that same 71-play game
through the installed library, CLI/editor and browser. The three runnable
sources use token-spacing adaptations. BASBAL and BASBL1 count as two corpus
listings, and the recovered DEMON menu is an accompanying program outside the 108. The browser bundles the three baseball programs.

The [SLOTS replay](slots-edusystem30.md) matches all 21 printed spins and
running totals. The [REVERSE adaptation](reverse-edusystem30-review.md) verifies
a complete prefix-reversal win, replay and a fresh board. The
[EVEN1 adaptation](even1-edusystem30-review.md) verifies learning across rounds
and a fresh RUN that clears the learning table.

The [GUESS review](guess-edusystem30-review.md) identifies EduSystem 20 in
the book. The public EDUSYSTEM-30 adaptation matches the archived clues,
guess-count assessments, limit changes and fresh RUN using stored LOG arithmetic.

The [CALNDR adaptation](calndr-edusystem30-review.md) prints 12 months for
both the printed 1973 settings and the 1984 leap-year settings. The
[CHIEF adaptation](chief-edusystem30-review.md) matches the arithmetic and
23 lightning rows. [HI-LO](hi-lo-edusystem30-review.md) verifies payouts,
replay, a loss and a fresh zero jackpot. [ROCKSP](rocksp-edusystem30-review.md)
covers repeated moves, round counts and fresh RUN. [ROCKT1](rockt1-edusystem30-review.md)
verifies a crash, an 11-second perfect landing and a fresh mission.

The [FIPFOP review](fipfop-rsts-review.md) identifies the printed RSTS/E
conversion and records behavior on archived V04B-17 BASIC-PLUS.

The [DICE and TRAIN reviews](dice-train-source-review.md) preserve the printed
listings and record archive rejections of bare `RND`. TRAIN also needs string
input and comparison forms rejected by the archived interpreter. Original
interpreter identification remains open for both.

**BASIC 1.0 is NOT READY.** One game is an intermediate milestone. Every one
of the **108 pinned files** still requires disposition and behavioral evidence
under [release #109](https://github.com/jesselpalmer/BASIC/issues/109) and
[compatibility epic #114](https://github.com/jesselpalmer/BASIC/issues/114).

## What runs now

| Path                         | Verified result                                                                                                                                                                                                                                                                                                                                                                                               | Boundary                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public native BASIC          | Library, installed CLI/editor and browser run graphics, keyboard/Pong, arrays, calls, DATA/READ, CHANGE and supported PRINT USING forms.                                                                                                                                                                                                                                                                      | [Native language reference](language-v1.md).                                                                                                                         |
| Public selected MA2          | Exact-source Programs use selected-stamped lines, canonical supplied-tree checks and whole-source admission. Bounded short scalar INPUT, strings, integer USING images, arrays, control and output run through Basic. Direct and installed ESM/CommonJS complete reviewed 1CHECK; portable CLI runs its selected document; browser editor runs and edits it.                                                  | Unsupported forms fail before effects, including dead lines. The profile is a selected execution slice, not complete RSTS/PDP-11 emulation.                          |
| Public selected EDUSYSTEM-30 | Reviewed 23MTCH, LETTER, TRAP, LITQZ, MATHD, NUMBER, STARS, HURKLE, CHANGE, CHEMST, DIAMND, BATNUM, EVEN, ROCKET, BOUNCE, GOLF, BLKJAK, CHOMP, MUGWUMP, 3DPLOT and SLOTS run across the library, CLI and browser, alongside the documented adaptations, now including CALNDR, CHIEF, HI-LO, ROCKSP and ROCKT1. Archive checks cover game outcomes, drills, receipts, terminal patterns and lunar flight rows. | Bounded arrays, stored arithmetic, numeric `RND(expression)`, signed `FOR STEP`, and PRINT with TAB or comma zones. See the [profile scope](edusystem30-profile.md). |
| Public selected Altair 8K    | The reviewed LIFE2 matches the archived win, draw, restarts and coordinate retries.                                                                                                                                                                                                                                                                                                                           | Bounded game forms and explicit array dimensions. See the [profile scope](altair-life2-profile.md).                                                                  |
| Historical certification     | **3 executable public selected profile families; 0 certified raw original-dialect whole-game passes.**                                                                                                                                                                                                                                                                                                        | 1CHECK's original interpreter and the raw corpus require separate evidence.                                                                                          |

The [corpus ledger](classic-games-ledger.json) records **43 reviewed
source differences / 65 unresolved**, **18 printed-system identifications / 90
unverified**, and **2 partial native paths / 106 not run**. These are distinct
evidence categories. Raw execution has a separate evidence column.

## Remaining blockers for the first game

| Outcome and owning issues                                                 | Evidence delivered                                                                                                                                                                                                                                                                                              | Next proof                                                                                                                                    |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete behavior — #115, #129                                            | Independent review checked every printed opening board, 48→41 pieces, the rejected printed continuation, invalid replay, YES reset, second game and NO exit. Installed CLI coverage exercises the selected file and LOAD/RUN/SAVE/reload. The delegated Chrome run verified a 47-piece result and replay at 48. | Record Jesse's acceptance separately. Keep raw, minimal correction and reviewed text distinct. Original-interpreter attribution remains #115. |
| Lifecycle — #116, #117, #118, #129                                        | Selected Program admission binds validation and execution to the same source. Selected Step/Stop and exact portable round trips pass. Failed browser admission reports a located error and retains the waiting run. Two 28-jump games complete in one public run.                                               | Resolve any mismatch found during user acceptance.                                                                                            |
| Accepted profile semantics — #58, #59, #119, #120, #121, #123, #126, #128 | Accepted 1CHECK forms run under explicit MA2 selection; bounded short scalar INPUT, strings and integer images also run in separate complete programs.                                                                                                                                                          | Keep unsupported row/retry, event continuation, broader image and array forms gated under their owning issues for the wider corpus.           |

The [milestone checklist](first-game-milestone.md) tracks first-game proof;
[technical support matrix](first-game-runtime-evidence.md#closed-support-matrix-before-activation)
and linked issues retain source contracts. Report progress as new runnable
behavior, closed blockers and remaining blockers. Preserve source bytes and
physical locations, native semantics, atomic replacement and fresh runs.

## Eventual 1.0 gate

Every one of the 108 pinned files needs source/dialect/dependency disposition and
required behavioral evidence. Valid but unsupported source, unknown dialects and
unresolved assets/services remain blockers. Evidence-backed defects and reviewed
corrections are tracked separately; narrowing valid-game scope requires Jesse's
explicit recorded decision in #109. Missing-book BUNNY/SNOOPY entries remain
outside the 108-file denominator.

Remaining corpus work includes verified DATA/READ, RNG, integer/logical forms,
subroutines/dispatch, additional DEF FN forms, modifiers, MAT and remaining file/terminal services as
required by the listings. They remain required even when unnecessary to 1CHECK.
Preserve native behavior, source bytes/locations, bounded execution, Step/Stop,
atomic replacement and fresh runs across all supported distributions.

The [reviewed 23MTCH fixture](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run)
reproduces the printed game through archived `EDU30.SV` and the public selected
profile. Acceptance checks cover the complete loss/replay/win and fresh RUN.
Keep raw, one-byte-corrected and reviewed text separate. LETTER adds bounded
character input, `RANDOMIZE`, backslash sequences and `CHR$(7)` output. TRAP
adds numeric fields carried across INPUT statements and `GOSUB`/`RETURN`.
LITQZ adds normal program termination via `STOP` before the required final `END`.
MATHD verifies default-zero and numbered numeric scalars. NUMBER verifies the
literal `.5` on its score-halving branch.
STARS verifies `ABS` on both sides of its secret number.
HURKLE verifies the archived `RANDOM` spelling and paired coordinate input.
CHANGE verifies stored decimal INPUT, bounded arithmetic and numeric PRINT.
EVEN verifies explicit numeric DIM declarations, same-name scalars and compact
LET. ROCKET verifies compiled decimal and scientific literals, square roots,
bounded integer powers and comma-aligned output. The pinned archive probes
cover these forms separately from the game transcripts.
The [archived random stream](edusystem30-rng.md) verifies evaluated numeric
arguments to `RND` and a fresh seed on each run. Broader numeric ranges and
diagnostic continuation remain under #116 and #123.

The [Altair profile](altair-life2-profile.md) runs the reviewed LIFE2
source with compact admission, indexed INPUT, terminal controls and numbered
RUN in the shared driver. Track broader Altair semantics separately from the
LIFE2 acceptance and original-interpreter evidence.

A fresh integrated release candidate must pass Linux/macOS checks, installed
ESM/CommonJS/types/CLI and actual browser tests against the exact package/static
artifacts, with independent and end-user review. #109 must record that candidate
and explicitly become READY before publication. Existing version metadata and
previous archives do not approve a release.

## Evidence and history

- [First-game outcome and acceptance](first-game-milestone.md)
- [First-game reference observations and technical support matrix](first-game-runtime-evidence.md)
- [Source inventory and provenance](classic-games-inventory.md), [source review](classic-source-review.md), and [ledger](classic-games-ledger.json)
- [Dialect design](dialect-design.md), [activation contract](profile-activation.md), and [shared MA2 value contract](ma2-shared-value-contract.md)
- [Delivery history and primary references through #204](classic-games-delivery-history.md)
- Preserved issue histories: [release #109](history/issue-109-before-outcome-roadmap.md), [epic #114](history/issue-114-before-outcome-roadmap.md), [acceptance #129](history/issue-129-before-outcome-roadmap.md)

The repository roadmap and live owning issues are authoritative for delivery.
The linked Google roadmap/backlog in the history are earlier planning snapshots.
Run `bun run check:corpus` when changing ledger-derived status; only new evidence
can change source certification or game-pass counts.
