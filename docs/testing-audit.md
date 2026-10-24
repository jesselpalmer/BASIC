# Test automation audit

Tracking: [issue #83](https://github.com/jesselpalmer/BASIC/issues/83).
Baseline: merged main `1f0b1668587c62863ef85a4cc031e766c5642b08` (after #81/#82).
Runtime under test: Bun 1.4.4; TypeScript source is the distributed implementation.

## Assessment

The existing suite already covered the lexer, parser, evaluator, runtime, INPUT
lifecycle, and checkout CLI extensively: 529 tests, 99.61% loaded-source lines,
and 94.58% loaded-source functions. The main weaknesses were in confidence about
installed consumers and coverage enforcement, rather than missing happy-path
unit tests. No production behavior change was required by this audit.

The strengthened suite has 575 tests and a separate installed-package acceptance
runner. The source tests pass both normally with coverage and in seeded shuffled
order. Measured product coverage is 99.80% lines / 98.44% functions. The source
inventory accounts for 16 measured runtime modules, one subprocess-only entry,
and one type-only module. See [quality checks](quality-checks.md) for exact gates.

## Findings and changes

| Finding                                                                                | Risk                                                                                   | Change                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installed async checks could exit 0 after expected output but before final assertions. | A broken completion contract could pass CI.                                            | Default failure exit status plus exact completion sentinel, set only after the entire acceptance suite resolves. A temporary mutation returning a never-settling Promise after real execution was rejected in both module formats. |
| Source and installed tests exercised different behavioral subsets.                     | Export or packaging regressions could miss realistic library workflows.                | Nine shared public acceptance scenarios run against source, installed ESM, and installed CommonJS.                                                                                                                                 |
| Installed CLI checked successful execution more thoroughly than failure paths.         | Wrong diagnostics, streams, exit codes, EOF, or cancellation could ship.               | Installed CLI tests assert syntax/runtime errors, missing files, bad arguments, EOF during INPUT, and pending-input SIGINT.                                                                                                        |
| Installed imports used closed stdin.                                                   | Accidental terminal setup or leaked handles could remain hidden.                       | Quiet imports and non-input file execution must finish while stdin remains open.                                                                                                                                                   |
| Global command installation was untested.                                              | Local imports could pass while documented CLI installation failed.                     | Install the tarball globally into temporary directories and resolve `basic` through PATH from an unrelated directory; check input and runtime-error behavior.                                                                      |
| Coverage only described loaded modules.                                                | A newly added, never-imported runtime file could evade percentages.                    | Compare LCOV to an independent source inventory, recognize erased types, reject absent modules, and enforce explicit per-module floors.                                                                                            |
| TTY clear and readline SIGINT callbacks were unexercised.                              | Terminal-specific behavior lacked direct assertions.                                   | Assert exact TTY clear bytes/non-TTY silence and raw Ctrl+C exit/listener cleanup.                                                                                                                                                 |
| Loop coverage lacked a systematic boundary cross-product.                              | Equal bounds, negative bounds, and direction combinations could interact unexpectedly. | 36 integer combinations with a closed-form count oracle and bounded stepping, plus an empty inner loop preserving its outer frame.                                                                                                 |
| CI ran on Linux only.                                                                  | Platform-specific package/terminal behavior could escape.                              | Run the complete check on Linux and macOS, with separate coverage artifacts.                                                                                                                                                       |
| Test order was always the default.                                                     | Shared state could create hidden dependencies.                                         | Add a second behavioral run with reproducible randomized order.                                                                                                                                                                    |

## Behavior and boundary matrix

These checks cover the currently implemented language contracts. The matrix
points to test ownership so future features have an obvious place to extend it.

| Area                      | Main edge cases and assertions                                                                                                                                                  | Owner                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Tokenization              | Label bounds, case, whitespace/newlines, decimal forms, quotes/comments, reserved words, invalid characters, source spans                                                       | `src/parser/tokenizer.test.ts`                                                                                         |
| Parsing                   | Precedence, complete consumption, malformed/missing operands, unique sorted labels, immutable programs, valid jump targets, matching and nested loop structure                  | `src/parser/parser.test.ts`                                                                                            |
| Evaluation                | Numeric/string types, variable case/suffix, undefined variables, finite results, division by zero, injected RNG, function arity/type, expression evaluation order               | `src/core/evaluator.test.ts`                                                                                           |
| Runtime                   | Numeric execution order, snapshots, reset/rerun, independent instances, step/run agreement, pre-effect validation, comparison/jump branches, loop control and errors            | `src/core/runtime.test.ts`, `src/core/branching.test.ts`, `src/core/loops.test.ts`, `src/core/loop-edge-cases.test.ts` |
| Async INPUT               | Exact strings, trimmed complete finite decimals, invalid retry, EOF, abort, cancel/reset/replacement, late host results, waiting states, sync API rejection of executed INPUT   | `src/core/input.test.ts`, runtime tests                                                                                |
| Immediate API             | Existing readLine/readLineAsync behavior, reset/errors/END, program-only command rejection, quiet defaults including CLS                                                        | `src/basic.test.ts`                                                                                                    |
| Terminal host             | Queued lines/EOF, abort races, errors/non-Error callbacks, overlapping reads, owned-listener cleanup, stream ownership, TTY clear                                               | `src/cli/terminal_host.test.ts`                                                                                        |
| CLI adapter               | Usage, diagnostics/output separation, file and interactive behavior, TTY Ctrl+C, injected dependencies and cleanup                                                              | `src/cli/run_cli.test.ts`                                                                                              |
| Checkout process          | Actual entrypoint, version, README program, stdin/EOF, file failures, real SIGINT, quiet imports, natural exit with open stdin                                                  | `src/__tests__/cli.test.ts`                                                                                            |
| Public library acceptance | Actual examples, stepping/reset/isolation, source-located failures, retry/EOF, cancel/late reply, replacement input, nested/descending/empty/inactive loops                     | `scripts/library-acceptance.ts`, `src/__tests__/library-acceptance.test.ts`                                            |
| Installed artifact        | Package-name ESM/CommonJS resolution, public exports/types, actual bundled examples, local executable, global PATH command, expected stdout/stderr/status, open-stdin lifecycle | `scripts/test-package.ts`                                                                                              |
| Coverage gate itself      | Missing new file, type-only-to-runtime transition, empty/stale records, stale entry exception, missing counters, per-module regressions, normalized paths                       | `scripts/coverage-inventory.test.ts`                                                                                   |

## What the installed tests prove

The package runner creates a tarball with `bun pm pack`, installs it in a
consumer under the system temporary directory, and resolves the public package
name there. It does not link back to the checkout. It checks packaged source and
examples and rejects shipped test files. The copied acceptance harness has only
erased type references to source; its runtime API comes from the installed
package. A strict external TypeScript consumer checks public types without
relying on the checkout's module resolution.

The nine shared scenarios test greeting whitespace/case, the deterministic
guessing game and a fresh rerun, the times-table fixture, step/reset/instance
isolation, located syntax/runtime errors, numeric retry/EOF, cancellation with a
late reply, replacement execution while input is pending, and loop interactions.
The consumer must finish all nine and report their exact names. Both ESM and
CommonJS run under Bun, the supported runtime; these are not Node compatibility
claims.

The local installed `.bin/basic` link is executed directly on POSIX and also
through Bun. Global installation uses temporary `BUN_INSTALL_GLOBAL_DIR` and
`BUN_INSTALL_BIN` overrides, then runs `basic` through PATH from another directory.
The real global installation is untouched. See [Bun configuration](https://bun.com/docs/runtime/bunfig)
for those overrides. Package tests have process timeouts, and all temporary
installation directories are removed in a `finally` block.

## Coverage interpretation and remaining limits

- **Not every possible input or branch:** Bun reports lines and functions here;
  neither 100% metric proves semantic correctness or exhaustive branch coverage.
  The source inventory closes silent file omissions, while edge cases and actual
  package/process assertions provide separate evidence.
- **Unmeasured subprocess code:** `src/cli/main.ts` and `bin/basic` run in child
  processes. Their behavior is tested; child coverage is not merged into the
  parent LCOV report. The exception is explicit rather than a hidden exclusion.
- **Defensive code:** the runtime retains missing-target/inactive-NEXT guards
  behind earlier validation, and terminal-host callback fields retain unused
  no-op initializers. These explain the narrowly reduced floors. Private state
  is not corrupted just to execute those lines.
- **Terminal realism:** tests combine injected TTY streams/raw Ctrl+C with real
  POSIX subprocess SIGINT. They are not a complete physical terminal/PTy matrix.
  Native readline can retain its shared keypress decoder after close; assertions
  distinguish that decoder from listeners owned by this application.
- **Platform scope:** CI covers Linux and macOS on pinned Bun. Windows and other
  Bun versions are not certified by this matrix. Global/POSIX signal cases are
  explicitly platform-conditional. Published-registry installation is not
  exercised: tests install the exact locally packed artifact without publishing.
- **Instruction scheduling at the audit baseline:** #41 was still open when this
  audit ran. It is now implemented: see [responsive execution](execution.md).
  Additional tests exercise deterministic scheduling/limits and real CLI SIGINT
  during self-jumps and long loops, including the packed installation. Synchronous
  execution remains blocking.
- **Future MVP features:** stored program editing (#42), LOAD/SAVE (#43), and
  editor/file acceptance work (#44/#45) need tests when implemented. Graphics
  will need host-contract and rendering acceptance tests of its own.

## Reproduce and extend

Run `bun install --frozen-lockfile` then `bun run check`. For focused debugging,
use `bun test path/to/test.ts`, `bun run test:coverage`, or `bun run test:package`.
Run another order with `bun test --randomize --seed <integer>`; record the seed
when reporting a failure. CI keeps LCOV and the inventory JSON per OS for seven
days.

For each feature, test successful behavior, rejected syntax/type/boundaries,
state transitions, and observable failure cleanup. Add a shared acceptance case
when behavior belongs to the public library contract, and an installed CLI case
when it affects entrypoints, packaging, diagnostics, or terminal lifecycle.
Keep expected results independent of the implementation; do not copy its
algorithm into the assertion.
