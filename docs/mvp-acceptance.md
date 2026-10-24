# MVP acceptance

The MVP is an editable terminal BASIC session backed by the same interpreter as
file execution and library use. The three maintained programs are
[`greeting.bas`](../examples/greeting.bas),
[`times-table.bas`](../examples/times-table.bas), and
[`guess.bas`](../examples/guess.bas). Run the complete gate with:

```sh
bun install --frozen-lockfile
bun run check
```

For a focused acceptance run:

```sh
bun test src/__tests__/examples.test.ts src/__tests__/library-acceptance.test.ts src/__tests__/persistence.test.ts src/__tests__/cli.test.ts
```

## Automated evidence

| Requirement                                                       | Observable acceptance evidence                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All three actual examples work in file mode and interactive `RUN` | [`examples.test.ts`](../src/__tests__/examples.test.ts) reads the maintained fixtures, invokes `runCli` with each filename, then enters their numbered source in reverse order, checks `LIST`, and runs twice. Both modes have independent expected output and prompts, consume every answer, produce no errors, and close their host. Each case has a five-second deadline.                    |
| Deterministic guessing game and fresh state                       | The same tests inject `RND() = 0.41`, making the secret 42. Answers 20, 80, 42 produce `Too low.`, `Too high.`, and `Correct in 3 tries!`; a second `RUN` with 42 reports one try. Randomness is called once per run. The shared library acceptance repeats this through the public API.                                                                                                        |
| Times table, nested loops, negative steps, and empty ranges       | The example tests check all ten rows for tables 3 and 5, including the rerun. [`library-acceptance.ts`](../scripts/library-acceptance.ts) checks nested descending/ascending loops, an empty range, final counter values, and an illegal jump into a loop. Loop stepping has a fixed statement budget.                                                                                          |
| Arithmetic and string behavior and failures                       | The shared library acceptance checks expression precedence and string output, then division by zero, a string passed to `ABS`, and mixed string/number addition. It asserts error class, code, physical line, BASIC label, column, message, no execution after the failure, and a successful replacement run.                                                                                   |
| Edit, run, save, restart, load, and rerun                         | [`check-persistence.ts`](../scripts/package/check-persistence.ts), exercised by [`persistence.test.ts`](../src/__tests__/persistence.test.ts) and the installed CLI gate, saves sorted source with a quoted filename, starts another process, loads, lists, runs with input, and saves through the retained filename. CLI session tests also replace/delete lines and rerun after edits.        |
| Failed loads and declined/cancelled overwrite preserve work       | The persistence sessions check invalid syntax/control flow, missing files, directory reads, declined load/save, and failed writes. They assert retained source/default filename, destination bytes, dirty-source recovery, and no temporary files. On POSIX, an observed overwrite prompt triggers SIGINT; a new editor prompt and `LIST` prove recovery while destination bytes remain intact. |
| Loop and INPUT cancellation leave the session usable              | [`cli.test.ts`](../src/__tests__/cli.test.ts) and [`check-cli.ts`](../scripts/package/check-cli.ts) wait for printed execution/input markers before SIGINT. They observe a new prompt, list retained source, edit or replace it, run a recovery program, and exit successfully. File-mode cancellation returns 130. Real process-signal cases are POSIX-only.                                   |
| Installed consumers use the same runtime                          | `bun run test:package` packs and installs outside the checkout, then runs the shared library acceptance against ESM and CommonJS and checks the installed CLI. The copied harness imports runtime code only from the installed package.                                                                                                                                                         |

File mode delegates to `Basic.runAsync` in
[`run_cli.ts`](../src/cli/run_cli.ts); interactive `RUN` delegates to that same
method on a fresh source snapshot in [`repl.ts`](../src/repl/repl.ts). The tests
exercise those entry points without a second language implementation.

Subprocess checks use [`subprocess.ts`](../scripts/subprocess.ts): output marks
readiness, a five-second default deadline bounds deadlocks, and failed checks
kill and clean up their children. Library loops use statement limits or bounded
stepping; asynchronous consumer checks also require a completion sentinel. No
acceptance scenario depends on an arbitrary sleep.

## Short manual playthrough

Use an empty temporary directory for saved files; keep the example files intact.
The exact seeded guessing sequence above is automated; an ordinary terminal run
uses fresh randomness.

- Run `bun bin/basic examples/greeting.bas`; enter a mixed-case name with spaces
  and check that the greeting preserves them. Run
  `bun bin/basic examples/times-table.bas`, enter `3`, and check rows 1 through 10.
- Start `bun bin/basic`. `LOAD "examples/guess.bas"`, then `RUN`; follow the low/high
  hints until success. `RUN` again and check that its try count starts fresh.
- `LOAD "examples/greeting.bas"`, replace line 20 with
  `20 PRINT "Welcome, "; NAME$`, then `LIST` and `RUN`. Check the edited greeting.
  `SAVE "/tmp/basic-mvp-session.bas"`, then `EXIT`. Choose a new path if that
  filename is already in use.
- Restart the editor, `LOAD "/tmp/basic-mvp-session.bas"`, `LIST`, and `RUN`.
  Change line 20, try `LOAD "/tmp/basic-mvp-missing.bas"` using a nonexistent
  path, and check that `LIST` still shows the edit. Try `SAVE`, answer `no` to
  overwrite, and check the saved file from a second session still has its prior
  content. Try `SAVE` again and press Ctrl+C at confirmation; check the same.
- In the edited session, `RUN` and press Ctrl+C at the name prompt. Check `LIST`
  retains the program, then `RUN` and supply a name to prove recovery. `NEW`
  (confirm discarding), enter `10 PRINT "loop started"` and `20 GOTO 20`, then
  `RUN`. Press Ctrl+C, replace line 20 with `20 END`, and `RUN` successfully.
- `EXIT`, confirm if prompted, and check that the shell prompt returns without a
  stuck input handle.
