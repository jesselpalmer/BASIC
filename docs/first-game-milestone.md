# First complete game: reviewed 1CHECK

**Status: blocked; no complete historical game pass yet.** This is the next
outcome in the [roadmap](classic-games-roadmap.md), tracked by
[acceptance #129](https://github.com/jesselpalmer/BASIC/issues/129). It is an
intermediate delivery milestone; all 108 corpus files remain the eventual
[1.0 release requirement](https://github.com/jesselpalmer/BASIC/issues/109).

At main `5ff720318222f593534656ac55a4997bb850bba2`, the exact reviewed
source runs internally through play, quit, invalid replay response, reset and
exit. Independent expectations cover a seven-jump, 41-piece board and exact
output through a second game. Supplied trees, later instructions and bad B$
images are checked before effects; selected INPUT cancellation preserves a
fresh game. The candidate now carries exact source and detached lines through
shared prepared indexes. Selected numeric scalars read as zero and A$/B$ as
empty before assignment; implicit numeric arrays default to bound 10 in one or
two dimensions. The internal session steps by instruction and owns cancellation.
Public profile selection, cross-distribution acceptance and end-user play remain
open. Detailed
delivery evidence is in the [runtime matrix](first-game-runtime-evidence.md)
and linked issues.

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
      replacement remains to be proved. Merged #231 carries exact source,
      detached lines and shared prepared indexes into selected execution.
- [ ] **State/control semantics** (#58/#59/#123/#126): retain words across runtime
      scalars/arrays/loops; selected string replay and six captured loop cases
      work internally. Complete accepted defaults, DIM/index conversion, errors
      51/55 and general FOR/NEXT completion/reentry. Verify nested, repeated-entry,
      range/error and cleanup paths needed by the selected profile. Merged
      #227 rejects unsupported NEXT increments before termination decisions and
      checks nested unfinished-loop reentry without changing native. Merged
      #233 gives selected numeric scalars the documented zero default. Merged
      #236 adds one-dimensional implicit numeric array bound 10 and zero cells.
      Merged #239 extends this to two dimensions; #240 supplies selected empty
      A$/B$ scalar reads. DIM ordering, string arrays and other state policies
      remain open.
- [ ] **I/O/event semantics** (#119/#120/#121/#128): the opening PRINT/USING and
      selected committed F/T/A$ reads cover the internal session. Complete
      accepted input/output forms, source-located numeric event policy and
      independently checked move/summary/replay output. A selected-session
      transcript now checks the seven-move board, invalid move, retry, replay
      and second-game result exactly in merged #228; public host output is still
      open. The limited reference installation's normalized transport is not an
      output oracle. Merged #230 checks cancellation at the second input after the first has committed,
      source-located EOF/host errors and a fresh opening.
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
      the milestone delivered. Merged #234 steps one internal selected
      instruction with its real next source location. Merged #237 adds
      internal Stop ownership, including pending input; public host lifecycle
      remains open.

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
The seven-move output, bounded loop, input lifecycle and source-bound candidate
preparation, numeric and string defaults, implicit numeric arrays and internal
Step/Stop are merged.
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
