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

Reconciled against main `9fc47a2bbdfafe4895c504a4134c1d405a982cfa`, including
merged [#214](https://github.com/jesselpalmer/BASIC/pull/214) and
[#215](https://github.com/jesselpalmer/BASIC/pull/215).

| Capability                       | Current result                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public native BASIC              | Runs through the Bun library, installed CLI/editor and browser. Includes graphics, keyboard input, Pong, arrays, branches/calls, DATA/READ, CHANGE and supported PRINT USING forms. See the [language reference](language-v1.md).                  |
| Classic game examples            | Reviewed 1CHECK and 23MTCH fixtures have scripted **partial native** behavior tests. These are useful regression evidence, not completed historical games.                                                                                         |
| Selected MA2 implementation      | The exact reviewed 1CHECK source now executes 371 statements through the numbered and 48-piece opening boards, stopping at its first INPUT. Internal F/T/A$ reads are available but not committed to a resumable run. This is not a complete game. |
| Historical compatibility outcome | **0 executable public historical profiles; 0 certified whole-game passes.**                                                                                                                                                                        |

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

| Workstream and issue owners                       | Already available                                                                                                                                              | What must be completed                                                                                                                                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Program and statements — #116, #117, #118         | All 85 candidate forms parse and pass structural preflight; the internal runner reaches line 100 from exact source.                                            | Resume the shared run after INPUT and bind the remaining accepted statement semantics. Validate unsupported requirements before effects, including supplied/dead trees.                                               |
| State and control — #58, #59, #123, #126          | Word-preserving scalars/arrays, selected fractional subscript conversion, exact comparisons and small-integer loop control produce the opening 48-piece board. | Bind replay string state/conditions and remaining defaults, index/loop/error policies needed for a full run. Do not extend the narrow integer loop policy by native arithmetic.                                       |
| Input, output and events — #119, #120, #121, #128 | Parsed PRINT/USING renders the opening; a cancellable selected F/T/A$ input boundary returns values without committing them.                                   | Commit responses under execution ownership, implement retry/continuation and required numeric events, and verify full move/summary/replay output. The limited reference installation is not a complete output oracle. |
| Complete-game proof — #115, #129                  | Exact reviewed opening output and state reach the first prompt; partial native checks remain distinct.                                                         | Full supported play/result/quit/replay traces, source-bug distinctions, lifecycle and cross-distribution checks. Keep original attribution and broader corpus certification explicit.                                 |

The [milestone checklist](first-game-milestone.md) is the progress view. The
[detailed support matrix](first-game-runtime-evidence.md#closed-support-matrix-before-activation)
and linked feature issues retain the technical contracts.

## How the next work is selected

1. Connect the merged input boundary to a resumable shared runner, then prove
   the reviewed game's move, quit and replay behavior. Build on the existing
   opening trace and numeric implementation.
2. Resolve missing subscript, loop, INPUT/output and event evidence alongside
   implementation where files and dependencies permit independent work.
3. Require each implementation batch to identify the milestone behavior it
   advances and the remaining blocker. Standalone helper work needs a named
   dependency on that behavior. Use the existing shared parser/runtime.
4. Keep public historical selection gated until every accepted support row has
   its required semantics. Demonstrate complete behavior before claiming the
   first-game milestone, then expand across the pinned corpus.

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
