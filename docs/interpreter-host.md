# Interpreter, stepping, and terminal lifecycle

The [language and session contract](language-v1.md) is the syntax reference;
the [architecture guide](architecture.md) maps public entrypoints and module
ownership. This guide describes the `Basic` API and host lifecycle.

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

- `new Basic(host = {}, {dialect = 'native'} = {})` creates an empty runtime in
  `ready` state. Its read-only `dialect` selection is copied at construction.
  Only native is currently supported. Program and Line metadata must agree with
  the instance; legacy missing metadata means native. Unsupported metadata/options
  throw `TypeError` before BASIC effects; a rejected replacement keeps the previous
  loaded snapshot available for rerun. This is not a historical compatibility mode.
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
- `arrays` returns detached, immutable `ArraySnapshot` observations separate from
  scalar `variables`. Array declarations are validated across the complete source
  before effects; every reset/run allocates fresh cell storage. Stepping DIM is
  inert after preparation. Immediate DIM requires a complete program. See
  [native arrays](arrays.md) for declaration/access rules and observation limits.

`runAsync(sourceOrProgram?, {signal, instructionLimit, yieldEvery, scheduler, beforeStatement}?)`,
`stepAsync({signal}?)`, and
`readLineAsync(source, {line, offset, signal}?)` return promises and support
`INPUT` and `WAIT`. Their other behavior matches the synchronous methods. The existing
synchronous methods stay synchronous; reaching `INPUT` through them throws
`ASYNC_INPUT_REQUIRED` before asking the host for a value. A synchronous run may
still contain unreachable input after `END`.
Executing WAIT synchronously similarly reports `ASYNC_WAIT_REQUIRED`; see
[WAIT and animation](wait.md) for timing, range, host and cancellation rules.

The immediate `readLine`/`readLineAsync` options may include `dialect`, which must
match the instance; they cannot change its language during execution. Source
coordinates, cancellation and scheduling retain their existing behavior.

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

Implemented statements are `LET`, `INPUT`, `WAIT`, `IF/THEN`, `GOTO`, `FOR`/`NEXT`,
`PRINT`, `REM`, `CLS`, `END`, and the optional
[graphics statements](graphics.md).
[Expression evaluation](evaluator.md) supplies typed variables, arithmetic,
string concatenation, and `ABS`, `INT`, and `RND`. Runs and instances never share
mutable language state. Reset does not rewind the host's random sequence.

`PRINT` evaluates items left to right, joins displayed values without added
spaces, and appends one newline unless a trailing semicolon suppresses it.
Separators may be omitted between string-involved items; expression parsing and
the one-write-per-statement contract remain unchanged. See [adjacency](print-adjacency.md).
Blank `PRINT` emits a newline; numbers use JavaScript's finite string
representation, including displaying negative zero as `0`. All items evaluate
before one host write, so a failing item prevents output from that statement.
Earlier statements and consumed random calls are not rolled back.

`PRINT USING` evaluates its template then value expressions left to right,
formats one bounded integer-field pass, and writes once. A failed format writes
nothing from that statement; consumed host effects remain consumed. Format
failures point at the template expression, and host-write failures retain the
statement location/cause. It counts as one instruction for stepping and budgets.
See [the exact supported fields and limits](print-using.md).

`CLS` only delegates to the host; it preserves variables and normal fallthrough.
`REM` is inert. `END` halts without evaluating subsequent statements. Complete
source validation happens before any effects, including syntax after `END`.
Undefined variables and other execution-dependent checks remain runtime errors.

`IF left comparison right THEN label` evaluates both operands left to right.
True branches jump; false branches fall through. Numbers support `=`, `<>`,
`<`, `<=`, `>`, `>=`; strings support exact, case-sensitive `=` and `<>` only.
`GOTO label` always jumps. A step changes only the program counter and reports
the target statement in `nextLocation`; it does not execute the target in that
same step. Targets are exact labels, including forward/backward/self jumps.

Complete-program validation resolves all literal targets and rejects statically
known invalid comparison types before effects, including unreachable lines.
`MISSING_TARGET` points at a target literal and `TYPE_MISMATCH` at a comparison
operator. Value-dependent failures still come from the evaluator at execution.
The runtime builds one label-to-index map per prepared snapshot and uses one
jump method for conditional/unconditional branches, sharing destination checks
with loop skips and repeats.

[FOR/NEXT loops](loops.md) capture finite start/end/step values on entry, support
nested and descending loops, and use inclusive bounds. Zero-iteration loops
skip past their matching `NEXT`. The common runtime destination check rejects
entry into inactive loop bodies and drops frames exited by a jump, while
preserving active parents. Loop frames clear on completion/error/cancellation
and reset. Bounds, stepping, variable mutation, pairing, and jump rules are
documented in the loop guide.

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
An outstanding `runAsync` owns stepping between batches as well: public
`step`, `stepAsync`, and `readLine`/`readLineAsync` reject while it can still
advance instructions. After `halted` or `error`, they retain their no-op behavior.
Reset, cancellation, and replacement runs remain available between callbacks.
The REPL awaits program input before asking for another editor entry.

`cancel()` aborts pending input, WAIT, or a scheduled batch, halts execution, and returns an immutable state.
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

## Immediate library entries and stored terminal source

The terminal stores numbered source and executes full snapshots with `RUN`.
See the [terminal session guide](terminal.md). The existing
`basic.readLine(source, {line, offset}?)` and `readLineAsync` methods remain
available as legacy library adapters: they parse one numbered line, execute it
immediately, and share variables across entries. They do not edit terminal source.

`IF`, `GOTO`, `FOR`, and `NEXT` require a complete prepared program and report
`PROGRAM_REQUIRED` in this adapter. Use `run`/`runAsync`/`reset` for control flow.
Immediate entries run in arrival order; duplicate numeric labels fail. Blank
fragments do nothing, and `END` or an error blocks later entries until reset.

The first immediate entry replaces a prepared program with an empty snapshot.
Do not mix immediate entries with an active stepped program: reset first. To
switch back to stepping, reset with a program. Unnumbered immediate expressions
and statements are not part of the current terminal commands.

## Host callbacks

`createHost(overrides)` fills missing callbacks and preserves method receivers.
It copies only these callbacks and invokes none during construction. `Basic.host`
is a frozen callback object; caller-owned host instances remain mutable.

| Callback                       | Contract                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `write(text)`                  | Synchronous exact text output, including newlines. Default discards output.                                                                      |
| `clear()`                      | Synchronous clear-display request. Default does nothing.                                                                                         |
| `readLine(prompt, {signal})`   | Promise resolving to a complete line without its ending, or null at EOF. Reject with AbortError on cancellation; default rejects as unsupported. |
| `wait(milliseconds, {signal})` | Promise completing a WAIT; default is a cancellable timer task. Receives validated, rounded milliseconds.                                        |
| `random()`                     | Synchronous finite number >= 0 and < 1. Default is Math.random.                                                                                  |

Optional `readKey()` and `keyDown(key)` capabilities supply queued and held-key
input. They are independent of text INPUT; missing capabilities fail clearly.
See [keyboard input](keyboard.md) for the exported `LogicalKey` type, host
return values, ownership, source diagnostics, and browser focus policy.

Input callbacks serve both the terminal prompt and BASIC `INPUT`. Async
write/clear results are unsupported. `runAsync` also yields to host tasks every
256 statements by default. Its `RunOptions` accepts an instruction limit, batch
size, and injectable `ExecutionScheduler`; these are run options rather than
required host callbacks. See [responsive execution](execution.md) for limits,
scheduler cancellation, and diagnostics. Synchronous execution remains blocking.

`Host` includes `wait`; structurally typed complete hosts must provide it.
`new Basic` and `createHost` accept partial hosts and fill it automatically.

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
location and exits 1 in file mode. Interactive failures return to the editor;
EOF with dirty stored source then emits a complete recovery copy and exits 1.
File-mode Ctrl+C exits 130; interactive Ctrl+C cancels only the active
entry/confirmation/run and keeps the editor usable. The library never selects
process exit codes.

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

`Basic.variables` exposes copied, frozen variable entries for inspection. An optional
`beforeStatement(signal)` gate can suspend `runAsync` before each actual statement
without releasing async ownership. See the [debugger boundary](browser-debugger.md#shared-runtime-boundary)
for cancellation, failures, and immutable snapshot semantics.

## Organization and verification

`src/core/runtime.ts` owns statement dispatch and execution state;
`src/core/evaluator.ts` owns values, variables, and expression evaluation;
`src/core/comparison.ts` shares comparison type rules and pure result-type inference;
`src/core/loops.ts` pairs lexical loop structures and defines body membership;
`src/core/input.ts` owns input validation, retries, and abortable host reads;
`src/parser` owns syntax and snapshots; `src/cli` owns terminal/argument adapters;
`src/repl/program.ts` owns editable source and `src/repl/repl.ts` owns session
commands, confirmations, and fresh run snapshots. The public package entrypoint
is `src/index.ts`; `src/basic.ts` is an internal compatibility re-export of the
same runtime. `bin/basic` is the executable. Superseded per-command handlers and
the old line validator/executor were removed when their callers migrated.

`bun run check` verifies formatting, strict types, typed lint, behavioral tests
with coverage, and the installed package. Tests exercise ordered execution,
stepping, frozen state, isolation/reset/recovery, host errors/reentrancy, full
preflight, CLI output/errors, EOF/cancellation/SIGINT, listener cleanup, and
quiet ESM/CommonJS imports with stdin held open. Nothing is published by checks.

Graphics hosts may implement the optional `draw(command: GraphicsCommand)`
capability. Existing text-only hosts require no changes; executed drawing
statements report `GRAPHICS_UNAVAILABLE` when it is absent. See the
[graphics contract](graphics.md) for commands, palette, rounding and lifecycle.

### Multiple statements on a numbered line

Colon-separated members execute through the same prepared instruction driver.
`step()`/`stepAsync()` advance one member, preserving distinct physical columns
under a shared label. Gates, instruction limits and yields count members rather
than the structural sequence. GOTO targets the first member, false IF skips the
rest of the numbered line, and END halts before later members. Legacy immediate
`readLine`/`readLineAsync` reject sequences as PROGRAM_REQUIRED before any member
effects. See [the sequence contract](statement-sequences.md).

Literal GOSUB/RETURN use the same prepared driver and each cost one statement,
gate and instruction-budget unit. Locations identify real callee/return positions;
INPUT/WAIT inside a call preserve the same async ownership and generation rules.
END/cancel/error/reset clear all call and loop frames. Native call depth is
bounded at 1024; see [subroutines](subroutines.md).
