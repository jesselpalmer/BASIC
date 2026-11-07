# Classic-game compatibility roadmap

**Runs now:** native BASIC and a bounded public `basic-plus-v4a12-ma2` profile.
The [reviewed March 1975 1CHECK text](1check-reviewed-text.md) runs to END
under explicit selection through the library, portable CLI/editor and
[browser playground](https://basic-playground-rho.vercel.app/). Choose
**1CHECK · BASIC-PLUS selected profile** in the normal editor to edit and play it.
This establishes selected-configuration behavior; the original interpreter
and version remain unknown.

**Next outcome:** finish the [first-game milestone](first-game-milestone.md)
with a public seven-jump/replay/fresh-game trace across hosts, Step/Stop and
replacement evidence, independent review and a user playthrough. The
complete reviewed source already has a seven-jump internal trace; installed
ESM/CommonJS and portable CLI complete a public quit session; the extracted
browser artifact plays and edits a one-jump quit session on Linux/macOS.

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

| Outcome and owning issues                                                 | Evidence delivered                                                                                                                                                                                                                                         | Next proof                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete behavior — #115, #129                                            | The exact reviewed source has an internal seven-jump, 41-piece, invalid-continuation, replay and second-result trace. Public direct/installed library and CLI complete a quit session; real browser CI plays a legal jump, quits, then runs edited source. | Repeat the long game/replay expectation through the **public** distributed paths and record independent expected board, count and transcript evidence. Keep raw, correction and reviewed text distinct.                                        |
| Lifecycle — #116, #117, #118, #129                                        | Public source-bound Program rejects altered trees and unsupported dead code before effects; failed replacement retains the prior source. Selected INPUT cancellation and fresh runs have core tests.                                                       | Verify public browser Step/Stop, stale-input isolation, import/export/reload and fresh replay against the exact deployed artifact; independent review and user playthrough.                                                                    |
| Accepted profile semantics — #58, #59, #119, #120, #121, #123, #126, #128 | Accepted 1CHECK forms run under explicit MA2 selection; bounded short scalar INPUT, strings and integer images also run in separate complete programs.                                                                                                     | Resolve any observed mismatch in the first-game public traces before declaring the milestone. Keep unsupported row/retry, event continuation, broader image and array forms gated; pursue them under their owning issues for the wider corpus. |

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
