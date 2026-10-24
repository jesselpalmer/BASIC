# Quality checks

Use Bun 1.4.4 and the committed lockfile:

```sh
bun install --frozen-lockfile
bun run check
```

`check` runs the following commands in order, stopping with a nonzero exit code
on the first failure. CI runs this same command after a frozen-lockfile install.
The complete behavioral suite runs once, with coverage enabled.

| Command                 | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `bun run format:check`  | Check maintained files against the committed Prettier configuration.                                |
| `bun run typecheck`     | Strict TypeScript checking of source, tests, and package-check scripts.                             |
| `bun run lint`          | ESLint with recommended type-aware TypeScript rules.                                                |
| `bun run test:coverage` | Execute behavioral tests, print coverage, write LCOV, and enforce thresholds.                       |
| `bun run test:package`  | Install a packed tarball in a temporary consumer and verify imports, public types, parser, and CLI. |

For individual tasks, `bun run format` applies formatting, `bun run lint:fix`
applies safe lint fixes, and `bun test` runs the tests without coverage collection.
Lint fixes do not replace reviewing the change. Generated output, dependencies,
archives, the generated Bun lockfile, and BASIC fixtures are ignored by Prettier.
Prettier owns formatting; ESLint owns code correctness rather than line length.

## Type-aware lint policy

TypeScript files under `src/` and `scripts/` use typescript-eslint's
`recommendedTypeChecked` rules and Project Service against `tsconfig.json`.
JavaScript configuration and the extensionless CLI wrapper use ordinary ESLint
rules. This avoids pretending those files have TypeScript project information.

Typed lint checks include floating/misused promises, unsafe operations on `any`,
non-Error promise rejection reasons, and unnecessary assertions. Fix findings
rather than converting them to `any` or disabling a file's rules.

The terminal host normalizes a non-Error thrown by a prompt/output callback into
an `Error`, preserving its message and cleaning up its listeners. The CLI's
last-resort error handler also safely handles unknown rejection values. These
boundary fixes do not change BASIC syntax or normal execution behavior.

There is one narrowly scoped lint exception: the terminal-host regression test
intentionally throws a string to simulate an untyped third-party callback. Its
single-line `only-throw-error` exception is documented at the fixture. Production
code has no typed-rule overrides. Promise rejection tests await the real promise
and inspect the rejection rather than awaiting Bun's synchronous matcher result.

## Coverage baseline and floors

Measured with Bun 1.4.4 using the original 202 cases before these changes:

| Scope                           | Functions | Executable lines |
| ------------------------------- | --------: | ---------------: |
| All loaded source modules       |    95.44% |           99.57% |
| Lowest individual loaded module |    66.67% |           95.74% |
| Parser                          |      100% |           99.58% |
| Tokenizer                       |      100% |             100% |

After the typed-lint fixes and the additional callback-failure regression case,
all 203 tests pass and the rounded percentages above remain unchanged.

`bunfig.toml` sets **95% lines and 65% functions per reported file**. These floors
sit just below the lowest observed modules, so they establish a practical
starting guard without manufacturing tests for empty callbacks or hiding CLI
code. They apply to every loaded source file, not just the overall average.
Review threshold changes explicitly as the runtime grows; important new behavior
and failure paths still need tests regardless of the resulting percentage.

Both `text` and `lcov` reporters remain enabled. The text reporter is important:
Bun 1.4.4 does not enforce thresholds when only LCOV output is selected. Reports
appear in the check's console output and `coverage/lcov.info`. CI uploads the LCOV
file as the `coverage` artifact for seven days, including when a later check
fails. Generated reports are ignored by git and excluded from package contents.

## Scope and gaps

Bun measures modules loaded in the test process. The aggregate is **not a
whole-repository coverage claim**. No production file is excluded with a custom
coverage-ignore pattern; tests and dependencies use Bun's standard exclusions.

- CLI subprocess tests verify executable startup, EOF, SIGINT, error recovery,
  natural completion with open stdin, and imports. Their child-process coverage
  is not merged into the parent report. The CLI entry wrapper is therefore absent
  from that report, and a passing percentage cannot replace those tests.
- The TTY clear-display branch in `terminal_host.ts` is uncovered by the in-process
  stream tests. Its callbacks and the SIGINT callback in `run_cli.ts` also account
  for lower function percentages.
- Default host no-op callbacks, the legacy executor's final unsupported-keyword
  branch, and the parser's invalid-array API guard remain visible gaps.
- Type-only definitions have no executable coverage. The unused legacy command
  dictionary and empty line-number-rule module are not imported by tests and do
  not appear in the report. Do not import dead modules just to raise coverage.

Use reports to identify meaningful missing behavior checks. Do not exclude hard
paths or add tests that merely repeat implementation details to meet a number.
