# Classic-game compatibility roadmap

**Runs now:** native BASIC and a bounded public `basic-plus-v4a12-ma2` profile.
The [reviewed March 1975 1CHECK text](1check-reviewed-text.md) runs to END
under explicit selection through the library, portable CLI/editor and
[browser playground](https://basic-playground-rho.vercel.app/). Choose
**1CHECK · BASIC-PLUS selected profile** in the normal editor to edit and play it.
This establishes selected-configuration behavior; the original interpreter
and version remain unknown.

**Next outcome:** build a bounded EDUSYSTEM-30 execution path for
[23MTCH](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run).
The archived interpreter now reproduces the printed loss, retry, replay and win.
For [1CHECK](first-game-milestone.md), the delegated Chrome playthrough passed
and is recorded in #129. Jesse's personal acceptance and the game's original
interpreter attribution remain separate checkpoints.

**BASIC 1.0 is NOT READY.** One game is an intermediate milestone. Every one
of the **108 pinned files** still requires disposition and behavioral evidence
under [release #109](https://github.com/jesselpalmer/BASIC/issues/109) and
[compatibility epic #114](https://github.com/jesselpalmer/BASIC/issues/114).

## What runs now

| Path                     | Verified result                                                                                                                                                                                                                                                                                                                                              | Boundary                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Public native BASIC      | Library, installed CLI/editor and browser run graphics, keyboard/Pong, arrays, calls, DATA/READ, CHANGE and supported PRINT USING forms.                                                                                                                                                                                                                     | [Native language reference](language-v1.md).                                                                                                |
| Public selected MA2      | Exact-source Programs use selected-stamped lines, canonical supplied-tree checks and whole-source admission. Bounded short scalar INPUT, strings, integer USING images, arrays, control and output run through Basic. Direct and installed ESM/CommonJS complete reviewed 1CHECK; portable CLI runs its selected document; browser editor runs and edits it. | Unsupported forms fail before effects, including dead lines. The profile is a selected execution slice, not complete RSTS/PDP-11 emulation. |
| Historical certification | **1 executable public selected profile; 0 certified original-dialect whole-game passes.**                                                                                                                                                                                                                                                                    | The game's original interpreter/version and the other corpus files remain unresolved.                                                       |

The [corpus ledger](classic-games-ledger.json) still records **3 reviewed
source differences / 105 unresolved**, **1 printed-system identification / 107
unverified**, and **2 partial native paths / 106 not run**. These are distinct
evidence categories, not a release-completion percentage. The selected
reviewed-text run does not alter the raw corpus ledger.

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
subroutines/dispatch, DEF FN, modifiers, MAT and file/CHAIN/terminal services as
required by the listings. They remain required even when unnecessary to 1CHECK.
Preserve native behavior, source bytes/locations, bounded execution, Step/Stop,
atomic replacement and fresh runs across all supported distributions.

The [23MTCH reference evidence](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run)
identifies the two printed prompt/output delimiters and reproduces the printed
game through the archived `EDU30.SV`. Next, recover the generator transition
and initial state under #123. In parallel, #115 and #116 can define the reviewed
source and the bounded PRINT, INPUT and control-flow rules. Use #129 to verify
one complete loss/replay/win and fresh `RUN` through library, CLI and browser,
including RNG continuity across replay. Keep raw, one-byte-corrected and
reviewed text separate.

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
