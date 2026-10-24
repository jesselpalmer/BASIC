# Maintainability review

Reviewed baseline: `22c459a570efc25a75d84b05b3154329160b34eb`, after the stored
editor and responsive execution changes. This review pauses feature work to
improve ownership, readability, and the evidence provided by the tests.

Four reviewers started without conversation context and focused on architecture,
source readability, test quality, and tooling/package boundaries. Implementation
tracks were reviewed by a different reviewer before integration.

## Findings and changes

| Finding                                                       | Concrete consequence                                                                                                     | Resolution                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public stepping could compete with a suspended async run.     | A step could consume the next line, turn scheduler failure into an unlocated TypeError, or strand execution after INPUT. | Explicit async ownership and private driver stepping; regressions cover scheduler suspension, INPUT, diagnostics, budgets, and replacement.                        |
| Prepared indexes and loop state shared a large runtime class. | One snapshot's AST, label tables, loop pairs, cursor, and active frames had separate mutation sites.                     | Group prepared data atomically; give mutable control flow its own owner. Keep lifecycle and dispatch in Basic.                                                     |
| Cancellation races were duplicated.                           | Input and scheduling independently maintained listener cleanup, synchronous failures, and late promise settlement.       | One neutral abortable-operation helper; domain-specific INPUT/scheduler diagnostics remain at their boundaries.                                                    |
| Terminal state and helper callbacks were public.              | Callers could mutate lifecycle internals; CLI injection required the concrete class shape.                               | Private state and stable handlers, with structural host capabilities. Remove unused no-op initializers.                                                            |
| A terminal read was reserved after prompt output.             | Synchronous callbacks could strand a nested read, lose an input failure, or consume queued text after abort.             | Reserve request ownership before callbacks and make setup settlement explicit; test reentry, failure, close, cancellation, and replacement.                        |
| A listener-cleanup test did not assert cleanup.               | Removing the production listener removal still passed the entire baseline suite.                                         | Assert exact listener ownership after EXIT, EOF, read failure, and cancellation; verify an old session signal cannot affect a later session.                       |
| A fairness test depended on an infinite loop yielding.        | A microtask-only scheduler starved both cancellation and the test timeout.                                               | Bound the in-process regression; keep infinite programs in subprocesses with independent deadlines. Bound CI jobs as well.                                         |
| Package scenarios lived in long generated code strings.       | Important consumer programs escaped normal type checking, lint, and source navigation.                                   | Ordinary consumer fixtures, named library/type/CLI checks, and a shared subprocess lifecycle helper. Preserve isolated ESM/require and local/global installations. |
| Coverage and package test-file policies differed.             | A future `.spec.ts` file could escape coverage yet ship to users.                                                        | Exclude and reject both supported test naming conventions; verify a temporary marker is absent from the package.                                                   |
| Reference guides described shipped features as future work.   | Readers were told numbered terminal entries ran immediately and scheduling was unfinished.                               | Update current references, separate historical audit measurements, and document architecture and lifecycle invariants.                                             |

## Evidence and review corrections

The cleanup mutation now fails six REPL tests. The microtask-only scheduler
mutation fails promptly instead of hanging. Package mutations removing an export
or leaving the acceptance promise unsettled are rejected in both module formats.
Consumer type checks include expected failures, so accidental widening is visible.

Cross-review also preserved a compatibility detail: public step/immediate calls
in halted or error state remain no-ops while an async continuation settles. The
run's ownership guard protects instruction advancement without changing those
terminal-state observations. Cancellation still settles an outstanding run.

The parser's independent AST assertions, evaluator expected values, bounded loop
cross-product, iterative expression traversal, frozen snapshots, injected host
capabilities, and package completion sentinel were worth preserving. There was
no evidence for a new testing framework, dead-code dependency, or generic
interpreter framework. Cohesive modules were not split merely to meet a line count.

## Remaining runtime boundary

[Issue #92](https://github.com/jesselpalmer/BASIC/issues/92) tracks a pre-existing
readline construction failure: a disconnected TTY can fail raw-mode setup after
readline has attached listeners but before it returns a handle or registers its
cleanup. The review reproduced this with a real PTY and a small synthetic stream.
The read rejects, but readline's listeners remain. Removing arbitrary listeners
would violate caller ownership, so this needs a runtime fix or a separately
reviewed adapter. The issue includes a reproduction and completion criteria.

The integrated refactor passes `bun run check`: 677 tests, coverage inventory,
seeded order, formatting, strict types/lint, and packed ESM/CommonJS consumers,
negative public type contracts, local/global CLI installation, and session
recovery. These checks do not erase the known construction-failure limitation.

## Ongoing standard

Use the [architecture guide](architecture.md) to locate invariants and the
[quality checks](quality-checks.md) for enforced policy. New expression or
statement variants must satisfy exhaustive switches. Compiler checks reject
unused declarations and unreachable code; formatting owns layout.

Coverage exceptions remain explicit: the process entrypoint runs in subprocesses,
and two defensive control-flow guards cannot be reached through a validated
program. The terminal's former function-coverage exception is removed along with
the unused code. High measured coverage is evidence of execution, not a proof of
all inputs, interleavings, or platforms. Keep meaningful negative cases and
resource-ownership assertions with future work.
