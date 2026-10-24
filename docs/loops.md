# FOR/NEXT loops

The [language and session contract](language-v0.1.md#for-and-next) defines loop
syntax and semantics. This guide explains their runtime and host API behavior.

Complete programs support numeric loops:

```bas
10 FOR I = 1 TO 3
20 PRINT I
30 NEXT I
40 PRINT I
```

This prints 1, 2, 3, and then 4, each on its own line. `FOR` and `NEXT` also work
through the reusable runtime's synchronous and asynchronous stepping/running
APIs and the stored editor's `RUN` command. They require a complete program; the
legacy library `readLine` adapter reports `PROGRAM_REQUIRED`, as it does for
`IF` and `GOTO`.

## Values and repetition

The syntax is `FOR variable = start TO end [STEP expression]` and `NEXT variable`.
The variable is required on both statements, is case-insensitive, and must be
numeric (no `$` suffix). Start, end, and step accept expressions that evaluate
to finite numbers. The default step is 1; either signed zero is an error.

On entry, evaluate start, end, and step once, left to right, using the current
variable state. Assign the start only after all three values validate. A positive
step includes values <= the captured end; a negative step includes values >= it.
For example, `FOR I = 3 TO 1 STEP -1` visits 3, 2, 1. Changing a variable used
in an end/step expression does not change those captured values.

If the initial bound is false, skip to the statement after the matching `NEXT`,
leaving the variable at its start value. This also skips nested loops and their
effects. A body containing only `NEXT` is valid.

`NEXT` adds the captured step to the variable's current value, then tests the
inclusive bound. If it still holds, resume immediately after `FOR`; otherwise
discard that loop's frame and fall through. The variable retains the final
incremented value. `LET` and `INPUT` may change an active loop variable, and
the next `NEXT` uses the changed value. Non-finite increments are errors.

## Pairing and jumps

Whole-program validation pairs loops by lexical nesting in numeric line order,
independently of file order. Every `FOR` needs a matching named `NEXT`; missing,
extra, or mismatched partners fail before effects, even after `END`. Single-line
`parseLine` accepts syntactically valid, unpaired `FOR`/`NEXT` statements so the
stored editor can retain incomplete source until `RUN`.
Reusing an already active loop variable is a runtime error; an unreachable
nested header does not create a frame or trigger that error.

A body starts after its `FOR` header and includes its `NEXT`:

- Entering an inactive body with `GOTO` or a true `IF` is an error. This includes
  jumping to its `NEXT`, or to a nested header whose outer loop is inactive.
- Leaving a body discards only frames that do not contain the destination.
  An inner-to-outer jump retains the outer frame.
- Jumping to a `FOR` header discards its old frame and any exited inner frames,
  then enters the loop afresh when that header executes. Active parent frames
  remain in force.

Loop skips, loop repeats, `IF`, and `GOTO` share one runtime destination check.
Frames are private to each runtime and clear on completion, error, cancellation,
reset, or a new run. Old input continuations cannot alter a replacement run's
frames. State snapshots still expose only status, locations, and diagnostics.

## Diagnostics and examples

`MISSING_NEXT`, `UNMATCHED_NEXT`, and `MISMATCHED_NEXT` are program-validation
diagnostics. `ZERO_STEP`, `LOOP_VARIABLE_ACTIVE`, and `LOOP_ENTRY` are runtime
diagnostics. `LOOP_NOT_ACTIVE` is a defensive runtime check at `NEXT`.
Value mismatches use `TYPE_MISMATCH`; numeric overflow uses `NON_FINITE_NUMBER`.
Each points at the relevant BASIC statement, variable, value, or jump literal.

Run the packaged [times table](../examples/times-table.bas) from a checkout:

```sh
bun start examples/times-table.bas
```

Enter 3 to print the table from `1 x 3 = 3` through `10 x 3 = 30`.
Async runs yield between batches and accept instruction limits; see
[responsive execution](execution.md). While developing unfinished loops, use
`runAsync` with a budget or a bounded number of `step()` calls.
