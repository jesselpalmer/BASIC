# Interpreter, stepping, and terminal lifecycle

`Basic` is the reusable statement runtime. Imports and construction are quiet:
no terminal, filesystem, process exit, or Bun-specific API is used by the core.
The CLI and library execute through the same parser, evaluator, and statement
implementation. There is no legacy command fallback.

## Running and stepping

```ts
import {Basic, parseProgram} from 'node-basic-lang';

const output: string[] = [];
const basic = new Basic({write: (text) => output.push(text)});
const program = parseProgram('30 END\n20 PRINT "Score: "; SCORE\n10 LET SCORE = 5');

basic.reset(program); // Ready; no statements have executed.
basic.step(); // LET; running, nextLocation.label === 20.
basic.step(); // PRINT; output is ['Score: 5\n'].
const result = basic.step(); // END; halted, nextLocation === null.
basic.run(); // Starts the loaded program again with fresh variables.
```

CommonJS consumers on Bun can use `const {Basic} = require('node-basic-lang')`.
The package exports the parser, evaluator, errors, and public types separately.

- `new Basic(host = {})` creates an empty runtime in `ready` state.
- `reset(sourceOrProgram?)` clears variables, current location, diagnostics, and
  control-flow state, then prepares a program without executing it. Source is
  parsed and fully validated; a `Program` candidate is copied, validated, sorted,
  and frozen. Omission retains the loaded snapshot and rewinds it.
- `run(sourceOrProgram?)` resets as above and executes from the first numeric
  label until `END`, end of program, or failure. It never resumes a partially
  stepped run. Omission reruns the loaded snapshot with fresh variables.
- `step()` executes one statement of the prepared program. The last statement
  halts immediately; no extra step is needed. An empty program halts without
  host effects. Calls after `halted` or `error` return the existing state without
  executing anything. Reset explicitly to execute again.
- `status` is read-only. `state`, and the return values of reset/run/step, are
  immutable `RunResult` snapshots. Later execution does not change old results.

`runAsync(sourceOrProgram?, {signal}?)`, `stepAsync({signal}?)`, and
`readLineAsync(source, {line, offset, signal}?)` return promises and support
`INPUT`. Their non-input behavior matches the synchronous methods. The existing
synchronous methods stay synchronous; reaching `INPUT` through them throws
`ASYNC_INPUT_REQUIRED` before asking the host for a value. A synchronous run may
still contain unreachable input after `END`.

Each result contains:

| Field             | Meaning                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `status`          | `ready`, `running`, `waiting`, `halted`, or `error`.                                        |
| `currentLocation` | Last attempted parsed statement, including a failed one; initially null.                    |
| `nextLocation`    | Next statement to execute; null while waiting, on completion/error, or in an empty program. |
| `diagnostic`      | Frozen structured BASIC diagnostic on failure, otherwise null.                              |

Locations include the BASIC label and original physical positions, following
[the parser convention](parser.md). They span statements, with more precise
operator/name/target locations in diagnostics. Program arrays, variable maps,
and mutable execution internals are not exposed. Caller-owned candidate trees
remain mutable and do not affect the active snapshot after preparation.

## Statements and failures

Implemented statements are `LET`, `INPUT`, `PRINT`, `REM`, `CLS`, and `END`.
[Expression evaluation](evaluator.md) supplies typed variables, arithmetic,
string concatenation, and `ABS`, `INT`, and `RND`. Runs and instances never share
mutable language state. Reset does not rewind the host's random sequence.

`PRINT` evaluates items left to right, joins displayed values without added
spaces, and appends one newline unless a trailing semicolon suppresses it.
Blank `PRINT` emits a newline; numbers use JavaScript's finite string
representation, including displaying negative zero as `0`. All items evaluate
before one host write, so a failing item prevents output from that statement.
Earlier statements and consumed random calls are not rolled back.

`CLS` only delegates to the host; it preserves variables and normal fallthrough.
`REM` is inert. `END` halts without evaluating subsequent statements. Complete
source validation happens before any effects, including syntax after `END`.
Undefined variables and other execution-dependent checks remain runtime errors.

Errors are thrown to callers after state changes to `error`. Syntax failures
throw `BasicSyntaxError`; evaluator and host failures throw `BasicRuntimeError`.
Both provide `{code, message, label, line, column, offset}` diagnostics.
Host write/clear failures use `HOST_ERROR`, point at the statement, and retain
the original thrown value as `error.cause`. The runtime's diagnostic is copied,
so changing a caught error cannot change its saved state.

## INPUT, waiting, and cancellation

`INPUT ["prompt";] variable` accepts one variable and an optional literal prompt.
The host receives the decoded literal followed by `? `, or just `? ` without a
literal. It owns prompt display. A `$` target stores the exact answer, including
empty strings, spaces, or text such as `RUN`. Other targets require complete
finite signed decimal input; only surrounding spaces/tabs are trimmed. Empty,
partial, exponent, hexadecimal, and non-finite input prints
`Invalid number; please enter a finite decimal.` followed by a newline and
asks again. The target is assigned only after successful validation.

During a pending request, `state.status` is `waiting`, `currentLocation` points
at `INPUT`, and no successor statement runs. A successful `stepAsync` completes
only that statement; `runAsync` continues automatically. Another step or
immediate entry while waiting rejects without replacing the pending request.
The REPL awaits program input before asking for another editor entry.

`cancel()` aborts pending input, halts execution, and returns an immutable state.
The outstanding async operation rejects with `AbortError`. A supplied AbortSignal
has the same effect. Reset or a new run also aborts the previous request and
invalidates its continuation. The core settles cancellation even if the host
ignores its signal; late values/rejections cannot assign variables, emit output,
resume old statements, or overwrite a replacement run's state. Handle the old
operation's rejection when intentionally replacing it. Cancelled values are not
assigned, and a new run starts fresh variables.

EOF rejects with `BasicRuntimeError` code `INPUT_ENDED`. Rejected/thrown host
read failures and invalid host return types use `INPUT_FAILED`, preserving an
original host error as cause where present. Retry-output failures use
`HOST_ERROR`. Failure leaves an immutable diagnostic and `error` status;
cancellation leaves `halted` with no BASIC diagnostic. The core removes its
abort listeners on success, failure, cancellation, and replacement.

An invalid replacement retains the previous loaded snapshot, but clears
variables and leaves the runtime in `error`, with no executable next location.
Only explicit reset/run can restart it. Parser APIs expect parsed trees, not
untrusted/deserialized AST schemas; invalid API arguments may throw a TypeError
with no BASIC diagnostic. Calls to reset/run/step/readLine from within a host
callback are rejected before they can alter the current execution, including
callbacks invoked to read input or display retries.

## Transitional immediate entries

The REPL still executes numbered entries immediately until stored-program
editing lands in #42. `basic.readLine(source, {line, offset}?)` is its adapter:
it parses exactly one line and uses the same evaluator and statement executor.
Use `readLineAsync` for entries that may request input. Variables persist across
entries, entries run in arrival order, and duplicate
numeric labels fail. Blank fragments do nothing. `END` or an error blocks later
entries until reset. The REPL resets automatically in those cases.

The first immediate entry replaces any prepared program with an empty snapshot.
Do not mix immediate entries with an active stepped program: reset first. To
switch from immediate entries to stepping, reset with a program. No unnumbered
`RUN`, `LIST`, `EXIT`, or stored-line editing is implemented yet. A blank line or
EOF still closes the current REPL; Ctrl+C closes a waiting terminal with code 130.

## Host callbacks

`createHost(overrides)` fills missing callbacks and preserves method receivers.
It copies only these callbacks and invokes none during construction. `Basic.host`
is a frozen callback object; caller-owned host instances remain mutable.

| Callback                     | Contract                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `write(text)`                | Synchronous exact text output, including newlines. Default discards output.                                                                      |
| `clear()`                    | Synchronous clear-display request. Default does nothing.                                                                                         |
| `readLine(prompt, {signal})` | Promise resolving to a complete line without its ending, or null at EOF. Reject with AbortError on cancellation; default rejects as unsupported. |
| `random()`                   | Synchronous finite number >= 0 and < 1. Default is Math.random.                                                                                  |

Input callbacks serve both the terminal prompt and BASIC `INPUT`. Async
write/clear results are unsupported. Async execution awaits input, but does not
yet promise yielding to timers during busy programs; fair batches, busy-loop
interruption, and instruction limits follow in #41.

## Terminal and file adapters

`src/cli/run_cli.ts` owns argument routing and filesystem access. `runFile` reads
once and passes source to a fresh `Basic.runAsync(source, {signal})`. Terminal
input opens only when an executed `INPUT` requests it. Concurrent file runs have
isolated variables and state.
`runCli` owns SIGINT handling and closes its terminal host in `finally`.
`src/cli/main.ts` applies the returned code via `process.exitCode`, letting output
drain naturally. Successful completion returns 0; file/syntax/runtime errors 1;
Ctrl+C 130; excess arguments retain the earlier usage code 9. Program output
goes to stdout and errors to stderr. EOF during program input reports its BASIC
location and exits 1 in either file or interactive mode. Ctrl+C during input
exits 130. The library never selects process exit codes.

`TerminalHost` opens readline lazily. Piped lines queue in order, including the
final unterminated line at normal EOF. It permits one pending input request;
a second rejects without replacing it. Cancellation rejects that request and
removes its abort listener, allowing a new request. Late callbacks do not resume
a cancelled request. `close()` is idempotent, settles input, clears buffers,
closes readline, and removes owned listeners without destroying caller streams.

Already-ended or destroyed input returns EOF before opening readline. Recorded
stream errors reject reads. Abrupt closure settles pending input, preserves
queued complete lines before EOF, and discards an incomplete fragment. The
adapter removes owned input-close, error, readline, and abort listeners.

## Organization and verification

`src/core/runtime.ts` owns statement dispatch and execution state;
`src/core/evaluator.ts` owns values, variables, and expression evaluation;
`src/core/input.ts` owns input validation, retries, and abortable host reads;
`src/parser` owns syntax and snapshots; `src/cli` and `src/repl` own host/session
behavior. `src/basic.ts` and `src/index.ts` are the library entrypoints, while
`bin/basic` is the executable. Superseded per-command handlers and the old line
validator/executor were removed when their callers migrated.

`bun run check` verifies formatting, strict types, typed lint, behavioral tests
with coverage, and the installed package. Tests exercise ordered execution,
stepping, frozen state, isolation/reset/recovery, host errors/reentrancy, full
preflight, CLI output/errors, EOF/cancellation/SIGINT, listener cleanup, and
quiet ESM/CommonJS imports with stdin held open. Nothing is published by checks.
