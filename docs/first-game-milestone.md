# First complete game: reviewed 1CHECK

**Status: public selected profile runs the game; milestone review remains open.**
Merged [#260–#263](https://github.com/jesselpalmer/BASIC/pull/263) expose the
bounded `basic-plus-v4a12-ma2` profile. Exact reviewed source completes a
public direct and installed ESM/CommonJS session and a portable CLI session;
real Chromium CI plays and edits it in the normal editor on Linux/macOS. The
long seven-jump, 41-piece, invalid printed continuation, replay and second-game
trace is still an internal expectation. Public cross-host long-game/lifecycle
proof, independent review and a user playthrough remain before #129 can mark
this first-game milestone delivered. The game's original interpreter/version
is unknown and [BASIC 1.0](https://github.com/jesselpalmer/BASIC/issues/109)
is NOT READY across the 108-file corpus.

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

The public profile and distribution path are delivered; complete milestone
proof remains open. See the [roadmap](classic-games-roadmap.md) and
[support matrix](first-game-runtime-evidence.md) for boundaries.

The [hosted playground](https://basic-playground-rho.vercel.app/) offers
**1CHECK · BASIC-PLUS selected profile** in the normal editor, alongside the
earlier fixed-source playtest. Source edits and portable document imports keep
explicit profile context; bare `.bas` files default to native.

- [x] **Internal source trace** (#118/#121): selected MA2 state and output
      persist across F/T/A$ INPUT, legal and illegal moves, summary, invalid
      replay response, YES reset and NO exit. Fresh sessions, cancellation and
      instruction budgets have focused tests. This is not a public profile pass.
- [x] **Program/statement integration** (#116/#117/#118): merged #263
      exposes a source-bound selected Program, canonical supplied-tree checks,
      whole-source semantic admission and Basic's shared Run/Step/Stop driver.
      Failed replacement leaves the prior source available for a fresh run;
      native remains the default and unsupported source has no host effects.
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
      A$/B$ scalar reads. #255 verifies source-wide DIM ordering, including
      later and skipped declarations. String arrays, duplicate declaration
      diagnostics and other state policies remain open.
- [ ] **I/O/event semantics** (#119/#120/#121/#128): the opening PRINT/USING and
      selected committed F/T/A$ reads cover the internal session. Complete
      accepted input/output forms, source-located numeric event policy and
      independently checked move/summary/replay output. A selected-session
      transcript now checks the seven-move board, invalid move, retry, replay
      and second-game result exactly in merged #228; public host output is still
      open. The limited reference installation's normalized transport is not an
      output oracle. Merged #230 checks cancellation at the second input after the first has committed,
      source-located EOF/host errors and a fresh opening. Merged #243 adds
      source-bound 14-column ordinary PRINT comma zones in selected execution.
      Merged #245 retains consecutive commas as skipped zones in that selected
      source, with leading empty fields still unsupported. Merged #248 adds a
      pure bounded TAB layout operation; merged #252 binds candidate-only
      source `PRINT TAB(X)` while preserving native TAB names and arrays.
- [ ] **Complete game behavior** (#115/#129): verify the board, legal/illegal
      moves, state/count/result, quit and replay through public selected execution
      with independent expected state and output. Distinguish source defects from
      runtime diagnostics and preserve all three fixture identities. Merged #251
      proves the exact reviewed seven-jump/replay/second-result path through
      Basic's internal async driver; public host acceptance remains open.
- [x] **Public selection and distributions** (#116/#129): merged #263
      exercises explicit source/context through direct and installed ESM/CommonJS,
      types, portable CLI/editor and real Chromium on Linux/macOS. The exact
      browser editor source is editable under the selected profile. A complete
      public quit session is covered; longer game/replay evidence remains above.
- [ ] **Lifecycle and review** (#129): prove Step/Stop, cancellation, invalid
      input, failed replacement, fresh reruns and source preservation; complete
      independent implementation/evidence review and a user playthrough. Link the
      exact integrated commit, artifacts and reproducible evidence before marking
      the milestone delivered. Merged #234 steps one internal selected
      instruction with its real next source location. Merged #237 adds
      internal Stop ownership, including pending input; #254 proves internal
      prepared Program replacement and fresh reruns. Public host lifecycle
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

The next integrated batch should settle remaining first-game support and event
rows, expose the prepared selected source/context through explicit public
Program/profile selection, and then prove direct/installed library, CLI/editor
and browser play with Step/Stop, replacement and fresh runs.
The internal full-game driver proof, source-bound Program transport and selected
DIM ordering regression are merged. Earlier selected output, INPUT, state,
control and lifecycle work remains available for the public path. Resolve
remaining index/loop and event evidence concurrently
where dependencies permit. Carry selected source/context through library,
CLI/editor and browser, then prove lifecycle and exact-artifact acceptance.

For each batch, record here or in #129: the named behavior advanced, evidence at
an exact revision, which checklist item changed, and the next blocker. Split PRs
when this makes review or independent work useful; do not use the number of PRs
or parameterized tests as a milestone measure. New helpers must identify the
specific checklist behavior they unblock.

Completing this game does not close #114 or make #109 READY. Continue through the
remaining corpus, preserving all source/dialect/external-dependency obligations.
