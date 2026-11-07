# Classic-game compatibility roadmap

**Next outcome: certify a complete reviewed 1CHECK game under the explicit
selected V4A-12 MA2 configuration across installed library, CLI/editor and
browser artifacts.** The
[first-game milestone](first-game-milestone.md) defines its remaining work and
acceptance. This is the active delivery priority.

**BASIC 1.0 remains NOT READY.** The full pinned corpus contains **108 files**;
one completed game is an intermediate milestone. Release requirements remain in
[#109](https://github.com/jesselpalmer/BASIC/issues/109) and
[compatibility epic #114](https://github.com/jesselpalmer/BASIC/issues/114).

## What runs now

The main branch has an internal full-game trace and fixed-source browser
playtest. A public selected-profile branch is under review; its capabilities
below become current only when merged and its browser gate passes.

| Capability                       | Current result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public native BASIC              | Runs through the Bun library, installed CLI/editor and browser. Includes graphics, keyboard input, Pong, arrays, branches/calls, DATA/READ, CHANGE and supported PRINT USING forms. See the [language reference](language-v1.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Classic game examples            | Reviewed 1CHECK and 23MTCH fixtures have scripted **partial native** behavior tests. These are useful regression evidence, not completed historical games.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Selected MA2 implementation      | The exact reviewed 1CHECK source completes an **internal full-game trace through Basic's async driver**: seven legal jumps, rejected printed discontinuity, 41-piece result, invalid replay retry, fresh board, second 47-piece result and exit. A [fixed-source experimental browser playtest](https://basic-playground-rho.vercel.app/) accepts moves, quit, replay and fresh runs. The pending public profile branch adds exact-source `Program` transport, whole-source admission and selected browser/editor and portable CLI paths, plus bounded short scalar INPUT, strings and integer output images. These are selected-profile behaviors, not a claim about the game's original interpreter. |
| Historical compatibility outcome | **0 executable public historical profiles; 0 certified whole-game passes.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

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

| Workstream and issue owners                       | Already available                                                                                                                                                                                                                                                                                                                                       | What must be completed                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Program and statements — #116, #117, #118         | All 85 candidate forms parse. Source-bound candidates check later/dead instructions before effects. Basic's async driver runs the full reviewed game path with selected state and INPUT. A pending public branch stamps selected Program lines, retains exact source and rejects altered caller trees and dead unsupported instructions before effects. | Merge and verify the public profile in distributed consumers; extend only forms with evidence and whole-source gates.                                                                               |
| State and control — #58, #59, #123, #126          | Word-preserving state, selected numeric zero and string empty defaults, one/two-dimensional numeric implicit arrays, and bounded loops drive the internal game. Manual-backed tests confirm later DIM ordering; selected Basic distinguishes signed-word index conversion and bounds diagnostics and reruns fresh after failure.                        | Settle string arrays, duplicate DIM diagnostics, historical error 51/55 handler/continuation, remaining loop and numeric event policies; conservative bounds are not historical overflow semantics. |
| Input, output and events — #119, #120, #121, #128 | Basic owns selected F/T/A$ reads, including cancellation at TO after F commits and source-located EOF. The seven-move board, result and replay output have an internal trace. The pending branch accepts bounded short scalar INPUT, string assignment/comparison/PRINT and integer USING images in additional complete source programs.                | Settle remaining input row/retry and conversion events, fractional/string image and terminal-width policies; verify exact output across public hosts.                                               |
| Complete-game proof — #115, #129                  | The exact reviewed source has an internal full-game path through Basic's async driver, including seven jumps, 41 pieces, invalid printed continuation, replay and second result. The pending public branch runs a complete direct-library game session, adds the normal editable browser 1CHECK example and portable selected documents.                | Merge the branch after CI, prove the full session across installed ESM/CommonJS, CLI/editor and extracted browser, and record the exact milestone evidence. Original attribution remains separate.  |

The [milestone checklist](first-game-milestone.md) is the progress view. The
[detailed support matrix](first-game-runtime-evidence.md#closed-support-matrix-before-activation)
and linked feature issues retain the technical contracts.

**Current review batch:** bounded scalar INPUT, short string values and integer
USING images are independent source behaviors. The integration branch binds
them to a selected public Program, CLI document, browser session and editable
1CHECK example. Its full local check passes; real-browser CI and distributed
acceptance are still required before the public milestone is claimed.

## How the next work is selected

1. Close the remaining first-game support and event policies, then expose the
   prepared selected source/context through explicit public Program/profile
   selection without native fallback. Verify direct/installed library,
   CLI/editor and browser play with Step/Stop, replacement and fresh runs.
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
