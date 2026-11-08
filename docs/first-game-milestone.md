# First complete game: reviewed 1CHECK

**Status: independent review and delegated Chrome playthrough complete.**
Merged [#263](https://github.com/jesselpalmer/BASIC/pull/263) exposes the
bounded `basic-plus-v4a12-ma2` profile; [#265](https://github.com/jesselpalmer/BASIC/pull/265)
traces seven legal jumps, 41 pieces, the printed illegal continuation, invalid
replay, YES reset, a second game and NO exit through public Basic, installed
ESM/CommonJS, the portable file runner and real Chromium on Linux/macOS.
The independent reviews verified the evidence and found implementation gaps
addressed in the review batch below. #129 records Jesse's acceptance separately. The game's
original interpreter/version is unknown and [BASIC 1.0](https://github.com/jesselpalmer/BASIC/issues/109)
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

The public profile, distribution and long game trace are delivered. See the
[roadmap](classic-games-roadmap.md) and
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
      and second-game result exactly in merged #228; #265 repeats the long
      trace through public hosts. The limited reference installation's
      normalized transport is not an output oracle. Merged #230 checks
      cancellation at the second input after the first has committed,
      source-located EOF/host errors and a fresh opening. Merged #243 adds
      source-bound 14-column ordinary PRINT comma zones in selected execution.
      Merged #245 retains consecutive commas as skipped zones in that selected
      source, with leading empty fields still unsupported. Merged #248 adds a
      pure bounded TAB layout operation; merged #252 binds candidate-only
      source `PRINT TAB(X)` while preserving native TAB names and arrays.
- [x] **Public game behavior** (#115/#129): #265 proves seven legal jumps,
      41 pieces, rejected printed continuation, invalid replay, YES reset,
      second-game result and NO exit through public Basic, installed
      ESM/CommonJS, the portable file runner and real Chromium. Independent
      expected-state and transcript review is recorded below. Preserve
      all three fixture identities; original-interpreter attribution stays #115.
- [x] **Public selection and distributions** (#116/#129): merged #263
      exercises explicit source/context through direct and installed ESM/CommonJS,
      types, portable CLI/editor and real Chromium on Linux/macOS. The exact
      browser editor source is editable under the selected profile. The long
      game/replay trace is covered by #265.
- [x] **Lifecycle and independent review** (#129): #263/#264 bind and test public
      replacement, Step/Stop, stale-input isolation and fresh reruns through
      BrowserSession; #266 checks selected browser Step/Stop and exact-source
      portable import/export/reload on Linux/macOS Chromium. Independent
      implementation and output reviews are recorded below.
- [ ] **User playthrough** (#129): Play the hosted selected-profile example,
      including a move, quit, replay and a fresh run. Record the deployed revision
      and any mismatch before marking the milestone delivered.

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

## Independent review

At `3956402922ec13d8e0d5f0698f795e4b5c6b11f9`, the independent evidence review
checked the [pinned March 1975 scan](1check-reviewed-text.md) on page 164 and
computed each board from row/column coordinates. The seven jumped squares are
10, 11, 12, 15, 23, 31 and 55. The model agrees with all printed opening boards
and with 48→41 pieces in the public run. Square 12 is empty when the printed
sample next attempts 12→26. The public run rejects that move, preserves 41
pieces, reprompts after `MAYBE`, resets to 48 on `YES`, and reaches END on `NO`.
The review compared all 64 cells in the rendered boards and the exact library
output bytes, including the reviewed trailing spaces. The printed sample's
later 35-jump result has no continuous move history on the page.

The independent implementation review found a mutable supplied-source admission
gap, a private step cap affecting public replays, missing located browser
diagnostics, and terminal prompts that ran together.

- [#268](https://github.com/jesselpalmer/BASIC/pull/268) binds validation and
  execution to one source snapshot and completes two 28-jump games in one
  public run.
- [#269](https://github.com/jesselpalmer/BASIC/pull/269) reports located browser
  errors and preserves the current INPUT on rejected replacement.
- [#270](https://github.com/jesselpalmer/BASIC/pull/270) verifies the packed
  terminal executable's file and editor paths, including exact source and
  profile round trips. The terminal adds prompt punctuation at presentation;
  library prompt values remain the source literals.

Reproduce with `bun test src/core/ma2_public_profile.test.ts`,
`bun run test:package` and
`bun run test:browser selected-editor.e2e.ts documents.e2e.ts`. The release
check also installs the exact package archive and serves the extracted static
archive through a generic HTTP server.

The [integrated revision](https://github.com/jesselpalmer/BASIC/commit/2b1b97164baac7534734b16c6442fa464d06ccaa)
matches the locally validated code tree `b4823cdea495fd7e6ab7abe947e7052d05564f26`.
It passed 15,892 tests, installed-package checks and 105 Chromium cases each
against the checkout and extracted static archive. Linux/macOS release checks
also passed on [#268](https://github.com/jesselpalmer/BASIC/actions/runs/42457290535),
[#269](https://github.com/jesselpalmer/BASIC/actions/runs/42457291500) and
[#270](https://github.com/jesselpalmer/BASIC/actions/runs/42457322106).
The same revision passed the hosted seven-jump, replay and selected admission
recovery checks.

At Jesse's request, Codex opened the selected-profile example in a fresh Chrome
tab on deployed revision `60e66b2`. Inputs `1, 19, 0, YES, 0, NO` produced one
jump with 47 pieces, replay at 48 pieces with zero jumps, and normal completion.
The result was left open and recorded in [#129](https://github.com/jesselpalmer/BASIC/issues/129)
as delegated verification.

## Next batch and progress reporting

Record a user playthrough and any mismatch in #129 before declaring this
first-game milestone delivered. Wider state, I/O and event forms remain open
for the 108-file corpus under their owning issues.

For each batch, record here or in #129: the named behavior advanced, evidence at
an exact revision, which checklist item changed, and the next blocker. Split PRs
when this makes review or independent work useful; do not use the number of PRs
or parameterized tests as a milestone measure. New helpers must identify the
specific checklist behavior they unblock.

Completing this game does not close #114 or make #109 READY. Continue through the
remaining corpus, preserving all source/dialect/external-dependency obligations.
