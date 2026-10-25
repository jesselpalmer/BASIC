# BASIC 1.0 release checklist

[Issue #109](https://github.com/jesselpalmer/BASIC/issues/109) owns the exact
candidate, readiness decision, evidence and remaining publication steps. This
procedure prepares and validates artifacts; it does not publish a package,
create a tag, or create a GitHub release. Do not infer readiness from issue
closure, old test counts, or an earlier development snapshot.

## Contract and metadata

- Confirm package version `1.0.0`, the metadata-derived `BASIC 1.0.0` banner,
  [release notes](release-notes-1.0.md), README and changelog agree.
- Review the [language reference](language-v1.md), [public runtime API](interpreter-host.md),
  [support/extension policy](compatibility.md), and graphics/WAIT/keyboard guides.
  The reserved-name policy protects existing valid programs; optional future
  language work is not part of this release.
- Confirm #54, #55 and #56 are merged. Record real game playthroughs and independent
  animation/input/game/API review, resolving correctness, data-loss and
  responsiveness blockers. Keep the supported Bun/browser/platform scope precise.

## Validate the exact candidate

Use a clean checkout with the pinned Bun 1.4.4 and record its full commit SHA.
Run the same commands for the integrated candidate on Linux and macOS:

```sh
bun install --frozen-lockfile
bun run check
bun ./node_modules/@playwright/test/cli.js install --with-deps chromium --only-shell
bun run test:browser
bun run build:release
bun run test:release
```

`check` includes formatting, strict types, lint, coverage inventory/floors,
shuffled tests and installed package consumers. Chromium tests verify actual
controls, examples, game outcomes, focus, cancellation, replacement, persistence,
import/export and bounded resources. Tests and percentages complement recorded
end-user observations; neither substitutes for them.

## Review the actual artifacts

The release build writes to `dist/release/`:

| File                            | Purpose                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `node-basic-lang-1.0.0.tgz`     | Actual npm-packed source package, including public types, executable, docs and examples. |
| `BASIC-playground-1.0.0.tar.gz` | Versioned static playground, including bundled game/examples and assets.                 |
| `manifest.json`                 | Candidate identity and artifact filenames, sizes and checksums.                          |

Validate those exact bytes, rather than repacking a different archive later:

- Inspect the npm allowlist and executable permissions. Exclude test/spec helpers,
  development tools, dependencies, coverage, build output and stray archives.
- Install the actual npm archive into clean consumers outside the checkout.
  Exercise quiet ESM/CommonJS imports, public types, documented APIs, local/global
  CLI, text examples, source persistence/recovery and interruption. Verify clear
  unsupported graphics/keyboard diagnostics in terminal hosts.
- Extract the static archive outside the checkout and serve it on a generic HTTP
  server. Run actual browser checks against that extracted distribution,
  including Pong, examples, controls and source round trips. Nothing may depend
  on checkout-only files, application servers or a build performed by the user.
- Retain the manifest and exact artifacts. Link their CI artifacts and logs from
  #109; record full hashes, artifact names and successful commands. If artifacts
  differ by platform/build environment, identify the canonical publication set
  explicitly instead of mixing evidence for different bytes.

## Readiness decision

Require all readiness gates in #109, including a fresh green Linux/macOS run for
that exact candidate and concrete package/static-artifact evidence. Record the
commit, artifact identities, review outcomes and any blockers in the issue's
**Release decision** section. Change its actual field to `Readiness: READY` only
when every gate is satisfied. Instructions mentioning READY elsewhere are not a
release decision. Tell Jesse why this candidate is an appropriate 1.0 release.

A metadata, source or build change after validation creates a new candidate:
rebuild and revalidate the affected final artifacts and record their new hashes.
Evidence for earlier unpublished 0.1.0 preparation is historical and is not proof
for this release.

## Publication after readiness

1. Publish the reviewed npm archive to the intended public npm registry and
   create the matching `v1.0.0` tag/GitHub release using the recorded candidate.
2. Attach the exact reviewed static/package artifacts and manifest, with release
   notes describing requirements, migration and supported scope.
3. Verify a clean install from the published registry and downloads from the
   release. Match their checksums to the recorded artifacts, record URLs in
   #109, and close the release issue after successful verification.

Public hosting and a play-only exporter are optional follow-up work. Publication
credentials and release permissions belong to the release owner; local builds
and review do not require exposing them.
