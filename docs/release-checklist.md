# v0.1.0 release candidate checklist

This checklist prepares and validates a local candidate. It does not publish an
npm package, push a Git tag, or create a GitHub release. Publication and tagging
remain separate release-owner actions after review of the final integrated tree.

## Contract and metadata

- [x] `package.json` version is `0.1.0`; the interactive banner reads that same
      metadata, with explicit `BASIC 0.1.0` assertions and installed-package checks.
- [x] README documents Bun installation, file execution, terminal editing,
      statements/functions, errors, interruption, embedding, and legacy migration.
- [x] `docs/language-v0.1.md` is the implemented dialect reference. `ABS` and
      `INT` are expression functions; unsupported syntax and compatibility limits
      are explicit. `CHANGELOG.md` records changes and breaking behavior.
- [x] Bun >=1.4.4 is declared; `.bun-version` and `packageManager` pin 1.4.4.
      Linux/macOS CI installs that pin, uses the frozen lockfile, and runs
      `bun run check`. Dependencies and lockfile resolutions are unchanged.

## Validation

Run from the candidate checkout with Bun 1.4.4 on `PATH`:

```sh
bun install --frozen-lockfile
bun run check
npm pack --json --ignore-scripts --pack-destination /tmp
```

- [x] Frozen dependency installation and the full check pass: formatting,
      strict types, typed lint, coverage inventory/floors, shuffled tests, and packed
      installation acceptance.
- [x] The actual npm archive has version `0.1.0`, an executable `bin/basic`, all
      production source and public types, README, license, changelog, documentation,
      and three example programs. It excludes tests/specs/`__tests__`, development
      scripts, `node_modules`, `.github`, coverage, scratch/build output, and archives.
- [x] A separate temporary consumer installs the actual npm archive, imports and
      constructs the core quietly with stdin still open, and runs the installed
      command with expected output and exit status.
- [x] Package acceptance installs a Bun-packed archive outside the checkout and
      exercises quiet ESM/CommonJS imports, shared library acceptance, public types,
      installed local/global commands, file input/errors/interruption, editor
      recovery, and persistence. No runtime code is borrowed from the checkout.

Record validation evidence below only after successful commands. Rerun checks
after integrating additional acceptance or cleanup changes; this record is not
a substitute for validation of the final release tree.

## Candidate validation record

Validated on 2026-10-24 on Linux with Bun 1.4.4 and npm 11.9.0, integrating the
acceptance, cleanup, and release-candidate changes for issues #45, #46, and #47:

- `bun install --frozen-lockfile`: 103 packages checked, no dependency changes.
- `bun run check`: passed; both coverage and seeded-order runs reported 774
  passing tests, 0 failures, and 1 skipped CI-only Python-availability assertion.
  The real POSIX terminal-disconnect regression passed. Coverage inventory passed
  for 27 measured runtime modules, 1 subprocess entrypoint, and 2 type-only modules;
  measured coverage was 100% functions and 99.53% lines with the documented
  control-flow exception.
- Packed acceptance: all 15 shared library cases passed through ESM and CommonJS,
  alongside public types, installed local/global command behavior, interruption,
  editor recovery, and persistence.
- Actual `npm pack`: `node-basic-lang-0.1.0.tgz` contained exactly 55 expected
  files, with executable permissions on `bin/basic` and no excluded infrastructure.
  A new temporary consumer installed this npm archive with Bun. ESM/CommonJS
  imports and `new Basic()` exited quietly while stdin stayed open. Its installed
  command printed `3.14:-2` with exit 0 for the ABS/INT migration example, and
  the editor banner was `BASIC 0.1.0`. Temporary consumers and archives were removed.

No package was published and no release tag was created.
