# Architecture and invariants

The interpreter separates source preparation, execution, and host effects.
Modules own state with a shared lifetime; a module boundary is useful when it
protects an invariant, not simply when it reduces a line count.

## Source and execution

| Owner                                 | Responsibility                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `parser/tokenizer.ts`                 | Token spelling and physical source positions; no retained state between calls.                        |
| `parser/parser.ts`                    | Statement and expression grammar, including bounded nesting.                                          |
| `parser/program_validation.ts`        | Whole-program checks and immutable snapshots without retaining caller-owned objects.                  |
| `core/prepared_program.ts`            | A validated program and the label/loop lookup tables derived from that exact snapshot.                |
| `core/control_flow.ts`                | Instruction position, active loop frames, and destination rules shared by jumps and loop transitions. |
| `core/evaluator.ts`                   | Instance-local variables and iterative expression evaluation through injected host capabilities.      |
| `core/runtime.ts`                     | Public lifecycle, statement dispatch, async execution ownership, and source-located failures.         |
| `core/cancellation.ts`                | Abort races, listener removal, and consumption of late promise failures.                              |
| `core/input.ts`, `core/scheduling.ts` | INPUT retry/value rules and scheduling policy, with operation-specific error normalization.           |

Parsing a line permits incomplete forward targets and loop pairs for editing.
Validating a complete program checks every statement before effects, including
unreachable source. Source locations remain physical positions even though the
snapshot executes in numeric label order. Copying, freezing, type inference, and
evaluation of long flat expressions remain iterative to avoid stack exhaustion.

Prepared indexes and mutable execution state have different lifetimes. Replace
the prepared program atomically after validation. Reset execution state on every
new run; never reuse loop frames or variable values accidentally across runs.
Every branch, loop repeat, and loop skip follows the same destination rules.

## Async execution ownership

An async run owns instruction advancement until its promise settles. Public
stepping and immediate execution reject while that owner is active, including
between batches. Terminal-state step/entry calls remain harmless no-ops. Reset,
cancellation, and replacement runs invalidate the old
owner; they remain available between synchronous host callbacks.

A generation identifies replacement boundaries. After each await, check the
generation and abort signal before resuming execution. Compare controller identity
when releasing ownership so an old continuation cannot clear a replacement. Cancellation must
settle even when an injected input provider or scheduler ignores its signal.
The provider still owns cleanup of its external resources. Late completion of
old work must never affect a replacement run.

The synchronous host callback guard is a different invariant: a callback cannot
mutate execution in the middle of a statement. Keep it even when async ownership
is explicit. The execution budget counts statements, not INPUT retries or yields.

## Terminal and stored source

`repl/program.ts` owns editable source, the saved baseline, current filename, and
derived dirty state. `repl/persistence.ts` owns candidate validation and staged
file operations through the narrow `ProgramFiles` capability;
`repl/file_command.ts` parses quoted filenames independently of BASIC statements.
`repl/repl.ts` owns session commands, confirmation, and cancellation of the current
operation. Its stored source survives run failure and cancellation; it creates a fresh validated execution snapshot for
`RUN`. Session commands are not BASIC statements.

`cli/terminal_host.ts` owns readline, queued complete input, and its listeners.
It opens input lazily, preserves queued complete lines after EOF, and clears them
on explicit close. Cancelling a read settles that request; discarding an
unfinished entry preserves later complete input. Closing the host releases its
listeners without destroying caller-owned streams. Private `cli/readline_input.ts`
and `cli/readline_output.ts` adapters own fixed registrations on caller streams.
Readline only sees these adapters, so a constructor that fails before returning
an interface cannot leave its callbacks attached to caller input or output.
Input starts flowing after both readline and the host have attached their
handlers. Restoring the caller's original raw mode is best effort when a
disconnected TTY also rejects cleanup.

Reads and existence checks use the shared abort race so even an injected file
provider that ignores its signal cannot trap the editor. Late values and failures
cannot change session state. Preparation is awaited to retain ownership of its
staged resource; providers must honor cancellation and close and remove partial
writes before rejecting.

`cli/program_files.ts` implements file effects independently of the terminal.
It writes an exclusive temporary in the destination directory, closes it, and
checks cancellation before exposing a staged write. Installation is synchronous:
rename for an explicitly approved overwrite, or an exclusive hard link for a new
destination, followed by removal of the temporary name. The link prevents an
unapproved overwrite if another writer creates a destination during preparation.
No await or cancellation check separates installation from the editor's saved
baseline update. A failure before installation discards the temporary and
preserves session state. A temporary-removal failure after successful installation
is a warning, not a failed save. These operations do not promise power-loss
recovery or locking against concurrent changes to an approved overwrite target.

`cli/run_cli.ts` supplies the real filesystem capability at the CLI boundary and
connects these capabilities to file execution and process signals. It accepts a structural host contract; callers need not expose a concrete
terminal object's internal buffers or lifecycle fields. `cli/main.ts` and
`bin/basic` are the process entrypoints. Importing the public library is quiet.

## Changing the code

Keep runtime modules independent of Node/Bun APIs. Add host capabilities only
when the language needs an external effect; future graphics should follow that
boundary. Prefer a direct discriminated switch over a registry or visitor until
there is a concrete extension requirement. Exhaustiveness checks make a new AST
kind an explicit decision at every switch that handles it.

Comments should explain contracts, ownership, or a surprising constraint. Tests
should assert observable values, diagnostics, state transitions, and cleanup.
Use independent expected results, observable readiness, and bounded execution;
coverage alone cannot prove any of those properties. The
[quality guide](quality-checks.md) describes the enforced checks.
