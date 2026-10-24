# Repository instructions

- Read `docs/architecture.md` before changing interpreter or terminal ownership.
- Follow `CONTRIBUTING.md`; use descriptive Conventional Commit subjects for
  commits and PR titles, including `feat`, `fix`, `refactor`, `test`, `docs`, or `ci`.
- Run `bun run check` before publishing code changes.
- When the user authorizes merging, squash merge with the validated conventional
  PR title and PR number as the explicit commit title. Keep issue references in
  the body. Do not use a generic `Merge pull request ...` title.
- For stacked PRs, merge dependencies first and rebase remaining branches onto
  updated main before squash merging; inspect the resulting diff and checks.
- Do not rewrite published history unless explicitly requested; preserve an
  original-history backup and verify file trees when doing so.
