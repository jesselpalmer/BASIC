# Contributing

Use the pinned Bun version and run `bun install --frozen-lockfile`, then
`bun run check` before submitting changes. See [quality checks](docs/quality-checks.md)
and [architecture](docs/architecture.md).

## Commit messages and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>[optional scope][!]: <description>
```

Repository types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, and `revert`. Use lowercase types and scopes; keep the
subject at most 100 characters. Use `!` or a `BREAKING CHANGE:` footer for
incompatible changes. Describe the resulting behavior or concrete change rather
than generic subjects such as "updates" or "cleanup".

```text
feat(repl): load and save BASIC programs
fix(cli): release pending reads when input closes
refactor(core): separate prepared programs from execution state
```

PR titles follow the same format. The `Conventional PR title` CI check validates
them, including when a title is edited. To check locally:

```sh
PR_TITLE='fix(cli): release pending reads' bun scripts/check-commit-title.ts
```

Use **Squash and merge**. Set the resulting commit title to the validated PR
title with its PR number, for example `fix(cli): release pending reads (#95)`.
Write the commit body as a concise explanation of the change and validation;
retain issue-closing references. Do not accept GitHub's generic `Merge pull
request ...` subject. Branch commits should also follow this convention, though
the PR check validates the final squash title rather than historical/WIP commits.

For GitHub repository settings, enable squash merging and set its default message
to the PR title and description; disable merge commits and rebase merging if
squash-only enforcement is desired. These are repository settings, not files
that a PR can configure. Mergers must still select the conventional title.

For stacked PRs, merge dependencies first, then rebase the next branch on updated
`main` before squashing it. Squashing changes commit identity, so retargeting a
stack alone can leave already merged changes in the next PR's diff.

Do not rewrite published history during routine cleanup. An explicitly requested
history correction must preserve a backup and verify unchanged file trees.
