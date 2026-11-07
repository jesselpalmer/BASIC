# Classic-game compatibility roadmap

**Next outcome: complete the reviewed 1CHECK game under the selected V4A-12 MA2
configuration, through the library, CLI and browser.** The
[first-game milestone](first-game-milestone.md) defines its remaining work and
acceptance. This is the active delivery priority.

**BASIC 1.0 remains NOT READY.** The full pinned corpus contains **108 files**;
one completed game is an intermediate milestone. Release requirements remain in
[#109](https://github.com/jesselpalmer/BASIC/issues/109) and
[compatibility epic #114](https://github.com/jesselpalmer/BASIC/issues/114).

## What runs now

Reconciled through merged [#245](https://github.com/jesselpalmer/BASIC/pull/245)
and [#246](https://github.com/jesselpalmer/BASIC/pull/246).

| Capability                       | Current result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public native BASIC              | Runs through the Bun library, installed CLI/editor and browser. Includes graphics, keyboard input, Pong, arrays, branches/calls, DATA/READ, CHANGE and supported PRINT USING forms. See the [language reference](language-v1.md).                                                                                                                                                                                                                                                                                                                                          |
| Classic game examples            | Reviewed 1CHECK and 23MTCH fixtures have scripted **partial native** behavior tests. These are useful regression evidence, not completed historical games.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Selected MA2 implementation      | The exact reviewed 1CHECK source has an **internal complete-session trace** through quit/replay, instruction stepping and owned cancellation. A separate source-bound no-INPUT MA2 loop/output program now runs through Basic's own reset, step and run driver with selected state and snapshots. Selected numeric and string defaults, implicit numeric arrays and consecutive PRINT comma zones run internally. A seven-jump prefix reaches 41 pieces; the printed sample's following 12→26 is invalid because square 12 was cleared earlier. This is not a public game. |
| Historical compatibility outcome | **0 executable public historical profiles; 0 certified whole-game passes.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

The [corpus ledger](classic-games-ledger.json) records **3 reviewed source
differences / 105 unresolved**, **1 printed-system identification / 107
unverified**, and **2 partial native paths / 106 not run**. These measure different
evidence categories; they are not a release-completion percentage.

## Next demonstrable outcome

Run the separate [reviewed March 1975 1CHECK fixture](1check-reviewed-text.md)
through a complete supported game session: initialize the board, accept and
reject moves correctly, report piece counts/results, quit, retry invalid replay
answers and start a fresh game. Prove the expected state/output through direct
and installed library consumers, CLI/editor and the browser's extracted archive.

The target is compatibility with the explicit proposed `basic-plus-v4a12-ma2`
configuration. The game's original interpreter/version remains unknown; a
successful selected-configuration run must not be described as original-dialect
certification or an unchanged raw-corpus pass. Preserve the raw transcription,
minimal correction and reviewed-text fixture as distinct evidence.

## Remaining blockers for that outcome

| Workstream and issue owners                       | Already available                                                                                                                                                                                                                                                                                                                                                              | What must be completed                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Program and statements — #116, #117, #118         | All 85 candidate forms parse. The selected source-bound candidate carries detached lines and shared prepared indexes; later/dead instructions reject before effects and the internal run reaches END. Basic's driver now runs a selected no-INPUT source with selected values, snapshots and fresh reset; the internal session and Basic use one selected statement operation. | Connect selected INPUT to Basic's async statement owner, complete supported statement/event policy, and then carry the selected context through public Program preparation without native fallback. |
| State and control — #58, #59, #123, #126          | Word-preserving state, selected numeric zero and string empty defaults, one/two-dimensional numeric implicit arrays, and bounded loops drive the internal game.                                                                                                                                                                                                                | Settle DIM ordering, string arrays, remaining index/loop/error and numeric event policies for the accepted profile; conservative bounds are not historical overflow semantics.                      |
| Input, output and events — #119, #120, #121, #128 | Internal F/T/A$ responses, seven-move output, cancellation after F and source-located TO failures have focused evidence. Selected ordinary PRINT commas use source-bound 14-column zones, including the documented consecutive-comma skip.                                                                                                                                     | Verify historical input/error continuation and exact output across public hosts; the limited reference installation is not a complete output oracle.                                                |
| Complete-game proof — #115, #129                  | Internal exact-source traces cover seven jumps, 41 pieces, the printed sample discontinuity, quit/replay/exit, a second result and instruction-level Step. Merged #237 adds internal Stop ownership, including pending input.                                                                                                                                                  | Public direct/installed library, CLI/editor and extracted-browser playthrough; replacement, source transport and fresh-run acceptance; original attribution remains separate.                       |

The [milestone checklist](first-game-milestone.md) is the progress view. The
[detailed support matrix](first-game-runtime-evidence.md#closed-support-matrix-before-activation)
and linked feature issues retain the technical contracts.

**Newly merged:** [#246](https://github.com/jesselpalmer/BASIC/pull/246)
proves selected no-INPUT loop/output through Basic's reset/step/run driver while
sharing selected statement operations with the existing internal session.
Independent [#245](https://github.com/jesselpalmer/BASIC/pull/245) retains
consecutive source commas as skipped PRINT zones. Their combined tree passed the
full local gate. Public `Dialect` remains native until support and host
obligations close.

## How the next work is selected

1. Attach selected INPUT to Basic's existing async owner, preserving pre-effect
   admission, committed prior responses, cancellation and fresh-run behavior.
   Extend the shared selected prepared/value lifetime for accepted statements,
   then enable public profile selection only when supported rows and host
   obligations close.
2. Resolve independent subscript, loop, INPUT/output and event evidence while
   implementing the public execution path. Carry source context through CLI and
   browser after the supported profile is ready.
3. Require each implementation batch to identify the milestone behavior it
   advances and the remaining blocker. Standalone helper work needs a named
   dependency on that behavior. Use the existing shared parser/runtime.
4. Verify direct and installed consumers, terminal and extracted browser with
   Step/Stop, source transport and fresh runs before claiming the first-game
   milestone. Then expand across the pinned corpus.

Report progress as **new runnable behavior, closed blockers, remaining blockers**.
PR counts, test counts and coverage are supporting quality evidence. Update the
current status in place; link detailed CI/artifact records from PRs instead of
appending them to the front page.

## Eventual 1.0 gate

Every one of the 108 pinned files needs source/dialect/dependency disposition and
required behavioral evidence. Valid but unsupported source, unknown dialects and
unresolved assets/services remain blockers. Evidence-backed defects and reviewed
corrections are tracked separately; narrowing valid-game scope requires Jesse's
explicit recorded decision in #109. Missing-book BUNNY/SNOOPY entries remain
outside the 108-file denominator.

Remaining corpus work includes verified DATA/READ, RNG, integer/logical forms,
subroutines/dispatch, DEF FN, modifiers, MAT and file/CHAIN/terminal services as
required by the listings. They remain required even when unnecessary to 1CHECK.
Preserve native behavior, source bytes/locations, bounded execution, Step/Stop,
atomic replacement and fresh runs across all supported distributions.

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
