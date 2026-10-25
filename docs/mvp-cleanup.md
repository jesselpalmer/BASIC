# Terminal MVP implementation audit

This audit checks the cleanup requirements in
[issue #46](https://github.com/jesselpalmer/BASIC/issues/46) against the current
implementation. Most source migration had already landed before this audit;
removing live compatibility APIs or current validation boundaries would not be
legacy cleanup.

| Requirement                                                | Implementation evidence                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One parser and runtime for file, terminal, and library use | `cli/run_cli.ts` creates `Basic` and calls `runAsync` for files. `repl/repl.ts` does the same for `RUN`. `basic.ts` re-exports `core/runtime.ts`, and the package root exports that class. `core/prepared_program.ts` sends source through `parseProgram`; all statement execution uses `core/runtime.ts` and `core/evaluator.ts`.                                                                          |
| No superseded per-line validator/executor                  | No former per-command handler or separate line executor remains. `Basic.readLine` and `readLineAsync` are supported immediate library adapters: they call `parseLine` and the same runtime dispatch. `repl/program.ts` also needs `parseLine` to retain incomplete edits. Whole-program `validateProgram` supplies snapshot copying, target/type checks, and loop pairing; it is not an obsolete validator. |
| No unused source files or dictionaries                     | A local relative-import/export traversal from `src/index.ts` and `src/cli/main.ts` reached all 30 production TypeScript files. Manual review confirmed the paths above. `parser/tokenizer.ts` actively reads `dictionaries/reserved_words.ts`; its grammar words, built-ins, and reserved session command names are not a list of numbered statements. No source deletion was warranted.                    |
| No generated runtime artifacts                             | Tracked files contain TypeScript source, development tools/tests, documentation, and examples, with no generated JavaScript bundle, `lib`, `dist`, coverage report, or package archive. `.gitignore` excludes those generated outputs. Bun runs the source directly.                                                                                                                                        |
| One authoritative syntax reference                         | [Language and session contract](language-v1.md) owns syntax. Parser, tokenizer, evaluator, execution, loop, and runtime guides link to it and explain their specific APIs and invariants. Token recognition does not imply statement support. Legacy standalone `ABS`/`INT` forms remain documented only as migration examples.                                                                             |
| Public entrypoints and module ownership                    | [Architecture](architecture.md) identifies the package root, executable, internal compatibility re-export, and ownership of syntax, snapshots, control flow, values, host effects, and terminal source. The package exposes only its root through `exports`; private source paths are not additional public entrypoints.                                                                                    |

The cleanup changes documentation without changing language behavior. The
repository's `bun run check` covers formatting, types, lint, behavioral coverage,
randomized test order, and installed-package acceptance. Package acceptance
checks the same public imports and executable consumers use; it does not publish
anything.
