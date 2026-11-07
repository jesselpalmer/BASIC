# First complete game: reviewed 1CHECK

**Status: blocked; no complete historical game pass yet.** This is the next
outcome in the [roadmap](classic-games-roadmap.md), tracked by
[acceptance #129](https://github.com/jesselpalmer/BASIC/issues/129). It is an
intermediate delivery milestone; all 108 corpus files remain the eventual
[1.0 release requirement](https://github.com/jesselpalmer/BASIC/issues/109).

At main `6a5eb43639fa4af461fd8f427cd2590b4f78229e`, an internal runner
executes the exact reviewed source through a supported play/quit/replay session.
It prints the numbered and 48-piece opening boards; illegal 1→2 preserves the
board, legal 1→19 leaves 47 pieces, quit reports one jump, invalid replay text
reprompts, YES rebuilds the board, and NO exits. [#216](https://github.com/jesselpalmer/BASIC/pull/216)
and [#217](https://github.com/jesselpalmer/BASIC/pull/217) deliver this trace and
cancellable INPUT continuation. Merged [#219](https://github.com/jesselpalmer/BASIC/pull/219)
adds an independently enumerated two-jump board and 46-piece summary;
[#220](https://github.com/jesselpalmer/BASIC/pull/220) rejects unsupported later
source before effects. [#221](https://github.com/jesselpalmer/BASIC/pull/221)
binds the captured loop completion/reentry cases and
[#222](https://github.com/jesselpalmer/BASIC/pull/222) rejects bad B$ images
before output. [#224](https://github.com/jesselpalmer/BASIC/pull/224)
adds the seven-jump, 41-piece source-backed board and printed-sample gap;
[#225](https://github.com/jesselpalmer/BASIC/pull/225) checks supplied candidate
trees against exact source before internal execution. It remains internal: public historical profile
selection, cross-distribution acceptance and independent end-user play are open.

## Demonstration to deliver

The reviewed March 1975 source runs a complete supported play/quit/replay session
under explicit `basic-plus-v4a12-ma2` selection through the library, CLI/editor
and browser. Board state, output, input handling, errors and fresh runs agree
with independently justified expectations. A user can play the complete game;
parsing, printing the board or reaching the first prompt alone does not complete
this milestone.

Use `scripts/package/fixtures/classic/1check-mar75-text.bas`, SHA-256
`f4744d9a5e9c6aa8bd08375d743e2ab7800c68e3af4d8d1a495717a3e99894b4`.
Keep the raw source, line-74-only correction and reviewed-text fixture separate.
The [source review](1check-reviewed-text.md) documents the selected fixture.
The original interpreter/version remains unknown. Passing this selected
configuration proves that compatibility result only; source attribution and
original-dialect certification remain separate #115 obligations. Do not fill the
printed sample's discontinuity with invented moves or repair game logic.

## Remaining delivery checklist

The internal complete-session trace is delivered; the public game milestone
remains blocked. See the roadmap and
[support matrix](first-game-runtime-evidence.md) for component status.

- [x] **Internal source trace** (#118/#121): selected MA2 state and output
      persist across F/T/A$ INPUT, legal and illegal moves, summary, invalid
      replay response, YES reset and NO exit. Fresh sessions, cancellation and
      instruction budgets have focused tests. This is not a public profile pass.
- [ ] **Program/statement integration** (#116/#117/#118): the 85 candidate forms
      parse, and the selected source session checks later/dead instructions before
      effects and executes internally. Bind the supported
      forms through public Program preparation and the shared lifecycle. Preserve
      physical spans and immutable snapshots; the internal selected session now
      rejects unsupported supplied trees before effects, while public failed
      replacement remains to be proved.
- [ ] **State/control semantics** (#58/#59/#123/#126): retain words across runtime
      scalars/arrays/loops; selected string replay and six captured loop cases
      work internally. Complete accepted defaults, DIM/index conversion, errors
      51/55 and general FOR/NEXT completion/reentry. Verify nested, repeated-entry,
      range/error and cleanup paths needed by the selected profile. In review
      #227 rejects unsupported NEXT increments before termination decisions and
      checks nested unfinished-loop reentry without changing native.
- [ ] **I/O/event semantics** (#119/#120/#121/#128): the opening PRINT/USING and
      selected committed F/T/A$ reads cover the internal session. Complete
      accepted input/output forms, source-located numeric event policy and
      independently checked move/summary/replay output. A selected-session
      transcript now checks the seven-move board, invalid move, retry, replay
      and second-game result exactly in #228; public host output is still open. The limited reference
      installation's normalized transport is not an output oracle.
- [ ] **Complete game behavior** (#115/#129): verify the board, legal/illegal
      moves, state/count/result, quit and replay through public selected execution
      with independent expected state and output. Distinguish source defects from
      runtime diagnostics and preserve all three fixture identities.
- [ ] **Public selection and distributions** (#116/#129): after the accepted
      support matrix is complete, exercise explicit selection and source/context
      preservation through direct and installed ESM/CommonJS, types, CLI/editor and
      real Chromium against exact extracted artifacts on Linux/macOS.
- [ ] **Lifecycle and review** (#129): prove Step/Stop, cancellation, invalid
      input, failed replacement, fresh reruns and source preservation; complete
      independent implementation/evidence review and a user playthrough. Link the
      exact integrated commit, artifacts and reproducible evidence before marking
      the milestone delivered.

## Required behavior evidence

Existing partial native checks already prove portions of these expectations.
Repeat and extend them through the selected historical execution path; native
results do not satisfy this checklist by themselves.

| Scenario                              | Required observation                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start                                 | Eight aligned rows numbered 1..64; 48 initial pieces and 16 empty central squares.                                                                                                                                             |
| Illegal move 1→2                      | Rejection preserves the board and 48 pieces.                                                                                                                                                                                   |
| Legal move 1→19                       | Source square clears, midpoint 10 is removed and destination fills; 47 pieces remain.                                                                                                                                          |
| Continued play/result                 | A reproducible multi-move path through quit, summary, replay and exit with independent board/count/result expectations. Preserve the source's actual termination behavior; do not infer missing moves from the printed sample. |
| Quit 0 and replay                     | Correct counters/summary; invalid replay answer reprompts; YES restores 48 pieces and resets the move count; exit follows the source. A new RUN owns fresh runtime state.                                                      |
| Invalid/fractional/out-of-range input | Follow the settled profile/input/index rules and document source bugs separately. No silent repairs, guessed error replacement or native-policy fallback.                                                                      |
| Lifecycle and transport               | Stop/retry/rerun/replacement preserve source and isolate executions; selected context and exact source survive documented import/export/load/save routes.                                                                      |

## Next batch and progress reporting

The next implementation work should close remaining selected support rows, then
connect the internal complete-session runner to an explicit public profile.
The seven-move source gap and supplied-tree admission are merged in #224/#225;
#227/#228 are independent reviewable loop-domain and exact-output slices.
Resolve remaining index/loop and event evidence concurrently
where dependencies permit. Carry selected source/context through library,
CLI/editor and browser, then prove lifecycle and exact-artifact acceptance.

For each batch, record here or in #129: the named behavior advanced, evidence at
an exact revision, which checklist item changed, and the next blocker. Split PRs
when this makes review or independent work useful; do not use the number of PRs
or parameterized tests as a milestone measure. New helpers must identify the
specific checklist behavior they unblock.

Completing this game does not close #114 or make #109 READY. Continue through the
remaining corpus, preserving all source/dialect/external-dependency obligations.
