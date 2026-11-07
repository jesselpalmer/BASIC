# First complete game: reviewed 1CHECK

**Status: blocked; no complete historical game pass yet.** This is the next
outcome in the [roadmap](classic-games-roadmap.md), tracked by
[acceptance #129](https://github.com/jesselpalmer/BASIC/issues/129). It is an
intermediate delivery milestone; all 108 corpus files remain the eventual
[1.0 release requirement](https://github.com/jesselpalmer/BASIC/issues/109).

At main `9fc47a2bbdfafe4895c504a4134c1d405a982cfa`, an internal runner
executes the exact reviewed source through 371 statements: it prints the
numbered board, initializes 48 pieces with 16 empty center squares, and stops
at the first `INPUT` on line 100. The selected F/T/A$ read boundary is merged
but not connected to a resumable run. This is a concrete opening trace, not a
completed game or a public historical profile.

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

The syntax and opening slices are delivered, but every complete-game checklist
item below remains open. See the roadmap and
[support matrix](first-game-runtime-evidence.md) for component status.

- [ ] **Program/statement integration** (#116/#117/#118): the 85 candidate forms
      parse and the opening executes internally; make execution resumable at
      INPUT and bind all accepted forms through the shared runtime. Preserve
      physical spans, immutable snapshots and failed-replacement atomicity.
      Reject unsupported source and supplied/dead trees before effects.
- [ ] **State/control semantics** (#58/#59/#123/#126): retain words across runtime
      scalars/arrays/loops; bind string/default rules, supported DIM/index conversion
      and errors 51/55, IF/GOTO and FOR/NEXT completion/reentry. Verify nested,
      repeated-entry, range/error and cleanup paths needed by the accepted subset.
- [ ] **I/O/event semantics** (#119/#120/#121/#128): the opening PRINT/USING and
      selected uncommitted F/T/A$ reads exist; integrate owned input commit,
      retry/continuation, byte/padded comparisons and source-located numeric
      diagnostics. Verify move/summary/replay output independently; the limited
      reference installation's normalized transport is not an output oracle.
- [ ] **Complete game behavior** (#115/#129): verify the board, legal/illegal
      moves, state/count/result, quit and replay with independent expected state and
      output. Distinguish source defects from runtime diagnostics and preserve all
      three fixture identities.
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

The next implementation work should connect the selected input boundary to
the shared runner, retaining state across suspension and enforcing cancellation,
budgets and clean reruns. Prove legal/illegal moves, quit and replay in the exact
source. Resolve remaining string/index/loop and event evidence concurrently
where dependencies permit. Public
activation still requires the entire accepted support matrix; an internal
integration demonstration must be reported with its limits.

For each batch, record here or in #129: the named behavior advanced, evidence at
an exact revision, which checklist item changed, and the next blocker. Split PRs
when this makes review or independent work useful; do not use the number of PRs
or parameterized tests as a milestone measure. New helpers must identify the
specific checklist behavior they unblock.

Completing this game does not close #114 or make #109 READY. Continue through the
remaining corpus, preserving all source/dialect/external-dependency obligations.
