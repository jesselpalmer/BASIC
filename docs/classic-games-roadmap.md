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

Reconciled against main `dd1519bf933e3211bb319dca5af3cabfcda3caa9`, including
merged [#221](https://github.com/jesselpalmer/BASIC/pull/221)–[#228](https://github.com/jesselpalmer/BASIC/pull/228).

| Capability                       | Current result                                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public native BASIC              | Runs through the Bun library, installed CLI/editor and browser. Includes graphics, keyboard input, Pong, arrays, branches/calls, DATA/READ, CHANGE and supported PRINT USING forms. See the [language reference](language-v1.md).                                                                                                            |
| Classic game examples            | Reviewed 1CHECK and 23MTCH fixtures have scripted **partial native** behavior tests. These are useful regression evidence, not completed historical games.                                                                                                                                                                                   |
| Selected MA2 implementation      | The exact reviewed 1CHECK source has an **internal complete-session trace** through quit/replay. A seven-jump prefix reaches 41 pieces; the printed sample's following 12→26 is invalid because square 12 was cleared earlier. Caller-supplied candidate trees are checked against exact source before execution. This is not a public game. |
| Historical compatibility outcome | **0 executable public historical profiles; 0 certified whole-game passes.**                                                                                                                                                                                                                                                                  |

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

| Workstream and issue owners                       | Already available                                                                                                                                                                                                                                                                 | What must be completed                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Program and statements — #116, #117, #118         | All 85 candidate forms parse; the selected runner validates later/dead instructions and exact source-matched supplied candidate trees before effects, then executes through END. In review #231 carries exact source and detached lines with shared prepared instruction indexes. | Complete remaining support rows and bind the prepared candidate to the public Program/Basic lifecycle with explicit profile selection.                                                   |
| State and control — #58, #59, #123, #126          | Word-preserving state and bounded selected loops drive the game; #227 checks nested unfinished reentry and bounds NEXT candidate increments without changing native.                                                                                                              | Settle broader defaults, index/loop/error policies and numeric events required for the accepted profile; conservative overflow rejection is not historical overflow semantics.           |
| Input, output and events — #119, #120, #121, #128 | F/T/A$ responses commit under execution ownership; selected output prints boards and summary; #228 checks an exact seven-move transcript through replay and a second result. In review #230 checks cancellation after F commits and source-located TO failures.                   | Verify historical input/error continuation and output across public hosts and accepted forms; the limited reference installation is not a complete output oracle.                        |
| Complete-game proof — #115, #129                  | Internal exact-source traces cover a seven-jump, 41-piece board and the printed sample discontinuity, plus quit/replay/exit. Partial native checks remain distinct.                                                                                                               | Public direct/installed library, CLI/editor and extracted-browser playthrough; Step/Stop, replacement, source transport and fresh-run acceptance; original attribution remains separate. |

The [milestone checklist](first-game-milestone.md) is the progress view. The
[detailed support matrix](first-game-runtime-evidence.md#closed-support-matrix-before-activation)
and linked feature issues retain the technical contracts.

Merged [#224](https://github.com/jesselpalmer/BASIC/pull/224) checks the
source-reviewed seven-move board and printed sample discontinuity;
[#225](https://github.com/jesselpalmer/BASIC/pull/225) admits exact source-matched
supplied trees to the internal selected runner. Neither activates a public
profile or settles general loop, numeric event or host policies.

Merged [#227](https://github.com/jesselpalmer/BASIC/pull/227)
rejects out-of-domain selected NEXT candidates before a termination decision and
checks nested unfinished-loop reentry. Merged
[#228](https://github.com/jesselpalmer/BASIC/pull/228) independently asserts exact numbered,
opening, seven-move, summary, retry, replay, second-game and exit output. The
combined tree passed the full local gate. These remain internal selected-session
work; neither is public host acceptance or a general historical loop policy.

**In review:** [#230](https://github.com/jesselpalmer/BASIC/pull/230)
checks that a cancelled second move input cannot revive an old game and that a
fresh selected session has its original board; EOF and host failure retain the
TO source line. Independent [#231](https://github.com/jesselpalmer/BASIC/pull/231)
keeps validated exact source and detached candidate lines with shared prepared
instruction indexes. Their combined tree passes the full local gate. Public
`Dialect` remains native while lifecycle, event and host obligations are open.

## How the next work is selected

1. Close remaining support rows, then connect the source-bound prepared candidate
   to public Program/Basic lifecycle and explicit library selection. Supplied-tree
   admission is delivered internally.
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
