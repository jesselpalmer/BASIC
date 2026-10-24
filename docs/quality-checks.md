# Quality checks

Use Bun 1.4.4 and the committed lockfile:

```sh
bun install --frozen-lockfile
bun run check
```

CI runs this same check on Linux and macOS for pull requests to any branch,
including stacked feature branches, and pushes to main. Commands stop on the first
failure; each CI job has a 15-minute deadline.

Both CI jobs also install Playwright's Chromium headless shell and run
`bun run test:browser`. This builds the static playground and exercises the real
UI: examples, INPUT, edits and replacement runs, diagnostics, keyboard controls,
literal output, narrow layouts, and stopping both silent and printing infinite
loops after visible output truncation. Failed runs retain screenshots and traces.
For a local run, install the browser once:

```sh
bun ./node_modules/@playwright/test/cli.js install chromium --only-shell
bun run test:browser
```

On Linux, add `--with-deps` to the install command if system libraries are missing.
`BASIC_BROWSER_EXECUTABLE` may point to a locally installed compatible Chromium
when browser downloads are unavailable. CI uses Playwright's pinned browser.

| Command                 | Purpose                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `bun run format:check`  | Check maintained files with Prettier.                                                                               |
| `bun run typecheck`     | Strict TypeScript checking of source, tests, and scripts.                                                           |
| `bun run lint`          | Recommended type-aware TypeScript rules and ordinary JavaScript rules.                                              |
| `bun run test:coverage` | Behavioral tests, text/LCOV coverage, source inventory, and per-module floors.                                      |
| `bun run test:order`    | Repeat tests in reproducible shuffled order, seed `20261024`.                                                       |
| `bun run test:package`  | Pack and install outside the checkout; test library consumers, types, local CLI, and isolated POSIX global install. |

`bun run format` applies formatting; `bun run lint:fix` applies safe lint fixes.
Review those fixes. `bun test` is the quick behavioral run without coverage.
Generated output, dependencies, archives, the Bun lockfile, and BASIC fixtures
are ignored by Prettier. Prettier owns formatting; ESLint owns code correctness.

## Type-aware lint policy

TypeScript under `src/` and `scripts/` uses typescript-eslint's
`recommendedTypeChecked` rules and Project Service against `tsconfig.json`.
JavaScript configuration and the extensionless CLI wrapper use ordinary rules.
Typed checks include floating/misused promises, unsafe operations on `any`,
non-Error rejection reasons, unnecessary assertions, and exhaustive discriminated
switches. Compiler checks also reject unused locals/parameters, implicit returns,
switch fallthrough, unreachable code, and unused labels. Fix findings instead
of disabling file rules or using `any`.

Local test exceptions explain the boundary being exercised: one terminal-host
test throws a string to simulate an untyped callback, and the CommonJS consumer
uses an actual require import. Production code has no typed-rule overrides.

## Coverage enforcement

The historical [testing audit](testing-audit.md) and subsequent
[maintainability review](maintainability-audit.md) record findings and evidence.
Use the current report for measurements rather than a historical test count.
Subprocess entrypoint coverage is not merged into the source report.

`scripts/coverage-inventory.ts` owns the coverage policy used by
`scripts/check-coverage.ts`; Bun emits metrics without a second threshold policy.

| Measured product module                        | Minimum lines | Minimum functions |
| ---------------------------------------------- | ------------: | ----------------: |
| Default, including newly added runtime modules |          100% |              100% |
| `src/core/control_flow.ts`                     |           87% |              100% |

The control-flow exception covers the same two defensive guards previously in
`runtime.ts`: a missing validated jump target and an inactive NEXT frame. Their
12 executable lines are unreachable through a valid prepared program. Moving
them into a smaller module changes its percentage, not the untested behavior.
Runtime dispatch and terminal lifecycle now have the default 100% floors; the
unused terminal callback initializers have been removed. Do not corrupt private
state or add dead callbacks to satisfy a metric. Review any policy change.

The inventory walks `src/` and `playground/` independently of the modules loaded by tests. A new
runtime file absent from LCOV fails the check, rather than silently disappearing
from the denominator. Type-only modules are recognized using the TypeScript AST;
adding executable code makes them subject to coverage automatically. Declaration
files emit no runtime code. The two process-boundary exceptions are
`src/cli/main.ts`, exercised through real CLI launches, and `playground/main.ts`,
exercised through the actual Chromium UI. Portable browser session, document, and
transcript modules retain the default 100% floors. Tests verify the inventory's
rejection paths, including a newly omitted
file (including UI helpers), stale exceptions/floor paths, missing metrics, and coverage regressions.

The `text` reporter makes failures readable; `lcov` supplies the independent
inventory gate. See [Bun's coverage documentation](https://bun.com/docs/test/code-coverage).
Only `scripts/**` is excluded as test infrastructure; no product runtime module
is excluded by a coverage pattern. Tests use Bun's test-file exclusion.

Reports are written to `coverage/lcov.info` and `coverage/inventory.json`.
CI retains `coverage-ubuntu-latest` and `coverage-macos-latest` artifacts for
seven days, including reports produced before a later check fails. Generated
reports are ignored by git and excluded from the package.

## Maintaining the suite

Add negative cases and lifecycle assertions with each language feature. Check
observable output, diagnostics, public state, exit codes, and resource cleanup.
Use injected randomness/input rather than timing-dependent answers. Bound any
loop regression test so a broken interpreter fails instead of hanging.

Keep shared public acceptance cases in `scripts/library-acceptance.ts`. They run
against source and both installed module formats, using the actual example files.
Ordinary, checked consumer fixtures live in `scripts/package/fixtures/`; the
package runner only packs, installs, runs named checks, and cleans up. Its copied
harness must import product runtime code only from the installed package. Public
type fixtures contain both positive examples and expected compile failures.
Use `scripts/subprocess.ts` for deadlines, output readiness, and child cleanup.
Keep a completion sentinel and failing default exit status around async consumer
checks: a process can exit with an unresolved Promise and no active handles.

A coverage percentage cannot establish all possible inputs or branches. Real
subprocess checks, package checks, independent expected results, and reviewed
edge cases remain necessary even at 100% measured lines/functions.

The readline construction-failure regression uses a real disconnected POSIX
terminal. Its small PTY controller uses Python 3's standard library, with explicit
readiness and process deadlines. Local runs skip that case if Python 3 is absent
or on Windows; Linux/macOS CI requires Python and exercises it. The interpreter
and package consumers have no Python dependency. Synthetic ownership tests run
with Bun alone. See [issue #92](https://github.com/jesselpalmer/BASIC/issues/92)
and the [review record](maintainability-audit.md#readline-construction-boundary).

## Commit history

Follow [Contributing](../CONTRIBUTING.md) for Conventional Commit titles and
squash merging. A separate `Conventional PR title` workflow checks titles on PR
creation, updates, and edits. It checks the final squash title; behavioral tests
and source quality checks remain in `bun run check`.
