# TypeScript and Bun development

This repository uses strict TypeScript and Bun. `.bun-version` and
`packageManager` pin the development and CI runtime; `bun.lock` pins dependencies.
Bun executes the source directly, with no build step or generated runtime bundles.

For setup, formatting, types, lint, coverage, and installed-package verification,
follow [quality checks](quality-checks.md). Running tests alone does not replace
compiler or lint checks.

## Distribution and portability

The v0.1.0 candidate is named `node-basic-lang` and requires Bun >=1.4.4.
Development and Linux/macOS CI use exactly Bun 1.4.4. Node.js alone and browser
hosts are not supported distribution targets in this release. ESM imports and CommonJS
require are both supported on Bun; this is not a plain Node compatibility claim.
Public types are exported from the package root. Package acceptance installs the
exact local tarball in isolated consumers and verifies both module formats,
external type resolution, and local/global executable installation. It does not
publish a package. The executable banner derives its version from `package.json`;
there is no separate version constant or generated bundle to update.

The package allowlist includes `bin/`, production TypeScript under `src/`,
documentation, examples, and the changelog, together with standard package
metadata, README, and license. Test/spec files and `__tests__` directories are
excluded; development scripts, dependencies, coverage, and generated build output
are not shipped. The [release checklist](release-checklist.md) also verifies a
real `npm pack` archive without publishing it.

Core and parser modules use standard language features and injected host
capabilities. Terminal, signal, and filesystem operations belong to the CLI;
Bun-specific process APIs belong to development tools. Keep these boundaries so a
future browser or graphics host can reuse the interpreter. See
[architecture](architecture.md) for module responsibilities and lifecycle rules.

The test runner is `bun:test`; its mocks and spies use Bun's Jest-compatible
interface. Use observable request/output events to coordinate async tests, bound
all execution, and assert cleanup of resources owned by the code under test.
