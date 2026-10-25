# Responsive execution

The [language and session contract](language-v0.1.md) defines program behavior.
This guide describes the library's scheduling and cancellation controls.

`Basic.runAsync(source?, options?)` executes short batches and yields to the host
between them. The default scheduler uses a cancellable `setTimeout` task after
256 statements, allowing terminal signals, browser events, and other timers to
run even during `10 GOTO 10`. No Node or Bun runtime API is used in the core.

```ts
import {Basic} from 'node-basic-lang';

const controller = new AbortController();
const basic = new Basic({write: (text) => console.log(text)});
const running = basic.runAsync('10 GOTO 10', {
  signal: controller.signal,
  instructionLimit: 100_000,
});
controller.abort();
await running; // Rejects with an Error named AbortError.
```

The terminal already supplies its interrupt signal, so Ctrl+C interrupts file
programs during computation as well as INPUT. Stored source is retained; a fresh
run starts with fresh variables, loop frames, instruction count, and scheduling.

## Run options

The exported `RunOptions` extends `InputOptions`:

| Option             | Default                | Contract                                                                         |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------- |
| `signal`           | absent                 | Abort the run during computation, scheduling, INPUT, or WAIT.                    |
| `instructionLimit` | unlimited              | Nonnegative safe integer; reject before executing a statement beyond this count. |
| `yieldEvery`       | `256`                  | Positive safe integer; number of statements per batch.                           |
| `scheduler`        | cancellable timer task | `(signal: AbortSignal) => Promise<void>`; resolve to resume the next batch.      |

Validation of option values happens before replacing the current run. A custom
scheduler should yield to a host task and release resources when its signal
aborts. Returning an already resolved Promise is useful for deterministic tests
but does not let host events run. No yield is scheduled after END, the last
statement, or an exhausted instruction budget. Schedulers run between statements; they can never interrupt a single
expression evaluation or a synchronous host callback.

Every executed statement counts once, including REM, END, INPUT, and WAIT. Numeric
INPUT retries, time spent waiting, and scheduler yields do not consume additional
instructions. A zero budget permits an empty program and stops before the first
statement of a nonempty program. A finite program using exactly its budget
completes successfully. Exceeding the budget rejects with `BasicRuntimeError`,
code `INSTRUCTION_LIMIT`, located at the next statement; the interpreter enters
`error` state and keeps its source for another run.

A scheduler throw or rejection becomes a source-located `SCHEDULER_FAILED`
`BasicRuntimeError` at the next statement, with the original Error as `cause`.
Non-Error failures are normalized. Callers can recover with a fresh run.

## Cancellation and replacement

`basic.cancel()` halts execution and aborts pending input, WAIT, or scheduling. The old
`runAsync()` rejects with `AbortError`; attach a rejection handler when starting
work that may be cancelled. External abort has the same halted result.
Cancellation settles even if a custom scheduler ignores its signal or never
settles. A scheduler still owns any custom resources it creates and must honor
the signal to release them. The default scheduler removes its timer on abort.

Starting a new run or calling reset invalidates the old generation. An old
scheduler's late resolution/rejection or an old input reply cannot resume,
write output into, or change the replacement run. Signal listeners owned by the
runtime are removed on success, failure, and cancellation.

An outstanding `runAsync()` owns instruction advancement, including scheduler
waits. Calling `step()`, `stepAsync()`, or either immediate-entry method while
that run can still advance instructions rejects without changing it. After
`halted` or `error`, those methods retain their no-op behavior. Await the run
before starting separate execution, or explicitly reset/cancel/replace it.
`cancel()` also rejects an outstanding run whose final statement has already
halted the language; it is inert after the operation has settled.

Synchronous `run()` cannot yield to timers/signals and has no instruction-limit
option. Use `runAsync()` for untrusted or possibly infinite programs, with an
instruction budget when termination is required. This is cooperative scheduling,
not a sandbox or a hard real-time responsiveness guarantee.

`WAIT milliseconds` suspends within one statement using the host's cancellable
`wait` capability; `scheduler` still controls batch boundaries independently.
Completing WAIT starts a fresh batch, since that statement already yielded.
It does not reset the total instruction count or bypass its limit.
The default WAIT timer yields even for zero. Positive fractions round upward;
durations outside 0..2147483647 are rejected before a timer starts. See
[WAIT and animation](wait.md) for rendering and host behavior.
