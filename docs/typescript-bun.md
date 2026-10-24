# TypeScript and Bun development

Issue #66 moves this checkout to Bun 1.4.4 and strict TypeScript before evaluator
work. Language behavior and the separation between the core and CLI are unchanged.
The earlier backlog's JavaScript-only constraint is superseded by this decision.

Install Bun, then run:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run test:package
bun start
```

`.bun-version` and `packageManager` pin the development/CI runtime. `bun.lock` is
the dependency source of truth. TypeScript 6 is used because the current
TypeScript ESLint tooling does not yet support TypeScript 7. Both compiler and
lint run through Bun; running tests alone does not replace type checking.

All source, tests, and package-check scripts are included in the strict compiler
check. Public types describe host callbacks, source positions, diagnostics,
discriminated tokens/AST nodes, immutable program snapshots, and execution status.
No language evaluator or new BASIC commands are introduced here.

The package ships TypeScript source and requires Bun. Its name remains
`node-basic-lang`, but this checkout no longer targets plain Node execution.
Both ESM imports and CommonJS require work in Bun. Public types are exported from
the package root; no build step or generated bundles are needed. The packed
consumer check verifies imports, parser behavior, type consumption, executable
installation, and the executable's Bun shebang. No package is published.

Core/parser modules use portable language features and host interfaces rather
than Bun-specific runtime APIs. Terminal and filesystem operations remain in the
CLI host, preserving the path to a future browser and graphics host.

The 202 existing behavioral tests run with `bun:test`. Mocks/spies use Bun's
Jest-compatible interface. Tests drain all chunks from output streams and attach
rejection handlers before cancellation/error triggers; they retain the same
EOF, cancellation, SIGINT, stream failure, rerun, and listener-cleanup assertions.
