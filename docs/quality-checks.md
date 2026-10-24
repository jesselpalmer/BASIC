# Quality checks

Use Bun 1.4.4 and the committed lockfile:

```sh
bun install --frozen-lockfile
bun run check
```

CI runs this same check on Linux and macOS for pull requests to any branch,
including stacked feature branches, and pushes to main. Commands stop on the first failure.

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
non-Error rejection reasons, and unnecessary assertions. Fix findings instead
of disabling file rules or using `any`.

One terminal-host test intentionally throws a string to simulate an untyped
callback; its single-line `only-throw-error` exception explains why. Production
code has no typed-rule overrides.

## Coverage enforcement

The [testing audit](testing-audit.md) records the behavior matrix and limitations.
The audit change passes 575 tests, with **99.80% executable lines and 98.44%
functions across the 16 measured product modules** on Bun 1.4.4. These numbers
exclude test infrastructure and do not include subprocess entrypoint coverage.

Bun's native per-file floor is 95% lines and 75% functions. The additional
`scripts/check-coverage.ts` gate is stricter:

| Measured product module                        | Minimum lines | Minimum functions |
| ---------------------------------------------- | ------------: | ----------------: |
| Default, including newly added runtime modules |          100% |              100% |
| `src/core/runtime.ts`                          |           96% |              100% |
| `src/cli/terminal_host.ts`                     |          100% |               75% |

The runtime's two uncovered defensive guards cannot be reached through a valid
parsed program: target validation rejects missing labels, and control-flow
validation rejects entering inactive loop bodies. Terminal-host callback fields
have no-op initializers replaced before use. Do not bypass private state or
invoke unused callbacks just to raise a percentage. Review any floor change.

The inventory walks `src/` independently of the modules loaded by tests. A new
runtime file absent from LCOV fails the check, rather than silently disappearing
from the denominator. Type-only modules are recognized using the TypeScript AST;
adding executable code makes them subject to coverage automatically. The sole
subprocess-only exception is `src/cli/main.ts`, exercised through real CLI
launches. Tests verify the inventory's rejection paths, including a newly omitted
file, stale exceptions, missing metrics, and coverage regressions.

Both `text` and `lcov` reporters stay enabled: Bun 1.4.4's thresholds require the
text reporter. See [Bun's coverage documentation](https://bun.com/docs/test/code-coverage).
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
The installed harness must import runtime code only from the installed package.
Keep a completion sentinel and failing default exit status around async consumer
checks: a process can exit with an unresolved Promise and no active handles.

A coverage percentage cannot establish all possible inputs or branches. Real
subprocess checks, package checks, independent expected results, and reviewed
edge cases remain necessary even at 100% measured lines/functions.
