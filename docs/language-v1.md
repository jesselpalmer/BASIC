# BASIC native language reference — provisional 1.0

This is the authoritative reference for the **currently implemented native dialect**.
It is not the final 1.0 compatibility scope. The
[classic-game roadmap](classic-games-roadmap.md) adds required source-verified
profiles/features before release; none is implemented by this planning change.
The [README](../README.md) covers installation and quick starts;
[terminal editing](terminal.md) documents session workflows. This reference defines current behavior;
publication status and exact candidate evidence are recorded in the
[release readiness issue](https://github.com/jesselpalmer/BASIC/issues/109).

This project defines a small, line-numbered BASIC dialect for writing text
and graphics programs. It does not claim QBasic, GW-BASIC, or another BASIC's
compatibility.
The terminal, embeddable API, and browser use the same parser and runtime.
Graphics require an optional drawing capability provided by the browser host.
Keyboard functions similarly require queued or held-key host capabilities;
the browser captures keys only on its focused game surface.

The [support and compatibility policy](compatibility.md) describes current public
language/API boundaries and reserved names. Final profile/API design must precede
the 1.0 freeze; current valid native programs must retain their meaning.

## Programs and source text

- A program has one statement per numbered line. Labels are decimal integers
  from **1 through 65535**. Leading zeros are allowed and do not change identity:
  `010` and `10` name the same line. Labels such as `10abc`, `1.5`, `-10`, `0`,
  and `65536` are errors.
- A label and its statement are separated by at least one space or tab. Leading
  and trailing spaces/tabs are allowed. Blank lines are ignored; LF and CRLF
  line endings are accepted. Whitespace inside strings is preserved.
- Execute in numeric label order, regardless of source-file order. Reaching the
  end of that order completes the run normally.
- Files must not contain duplicate labels. In the interactive editor, entering
  an existing label replaces that line intentionally.
- A bare label is an editor deletion command. It is not a valid file statement.
- Keywords, function names, and variable names are case-insensitive. String
  values and filenames retain their original case.
- `REM` consumes the rest of its line as a comment, without interpreting quotes,
  punctuation, or keywords in that text. An empty comment is valid.
- There are no colon-separated statements or apostrophe comments in the current native dialect.

The editor retains source text for each stored line. `LIST` and `SAVE` arrange
lines by numeric label. Runs use an immutable snapshot: later edits affect the
next run, not an execution already in progress.

## Values, names, and expressions

Explicit [native arrays](arrays.md) support `DIM A(64), BOARD(7,7), NAMES$(2)`,
indexed expressions and assignments with optional LET. Bounds are literal,
nonnegative integers, include zero, and declarations apply to the complete
program before execution. Numeric/string elements start at 0/empty string;
scalars keep their existing undefined-name behavior and separate storage.
Indices must be safe integers within bounds. Native has no implicit dimensions,
indexed INPUT, `%` arrays, square-bracket access or MAT yet. DIM remains a valid
scalar name outside its declaration form. See the array contract for resource
caps, evaluation order, preflight diagnostics and bounded observations.

There are two value types: finite numbers and strings. Numbers use JavaScript's
IEEE 754 double-precision arithmetic; decimal fractions need not be exact.
Variables are not initialized implicitly. Reading an undefined name is an error.

Names start with an ASCII letter, followed by zero or more ASCII letters or
digits. A final `$` marks a string variable: `NAME$`, `A1$`. Other variables are
numeric: `SCORE`, `N2`. Reserved keywords and built-in function names cannot be
variable names. Names have no significant-length truncation.

Assigning a string to a numeric variable or a number to a `$` variable is a type
error. There is no implicit conversion between numbers and strings.

### Literals

Unsigned decimal literals have the form `digits[.digits]` or `.digits`; a trailing
decimal point is also allowed. An optional E/e exponent has an optional sign and
one or more digits: `1E-3`, `8.84361E-04`, `.5e+2`, `1.e2`. A leading sign is a
unary operator. Hexadecimal, binary, `NaN`, `Infinity` and incomplete exponents
are outside the native grammar. Conversion uses finite IEEE doubles: overflow
rejects, while subnormal values and underflow to zero are permitted. Labels,
jump targets and DIM bounds still require plain decimal integers.

Strings are enclosed in double quotes. Double a quote to include it:

```bas
10 LET MESSAGE$ = "She said ""hello""."
20 PRINT MESSAGE$
```

Backslashes are ordinary characters, not escapes. Strings do not span physical
lines. An unterminated string is a syntax error.

### Operators and functions

| Precedence, highest first      | Meaning                             | Associativity     |
| ------------------------------ | ----------------------------------- | ----------------- |
| Parentheses and function calls | Group or evaluate a built-in        | Explicit grouping |
| `^`                            | Numeric exponentiation              | Left              |
| Unary `+`, `-`                 | Numeric identity and negation       | Right             |
| `*`, `/`                       | Numeric multiplication and division | Left              |
| `+`, `-`                       | Numeric addition and subtraction    | Left              |

Binary `+` also concatenates **two strings**. All other arithmetic requires two
numbers. `"Score: " + 3` is an error; use `PRINT "Score: "; 3` instead. Division by
zero and every non-finite numeric result are errors. Powers bind before unary
minus: `-2^2` is `-4`, `(-2)^2` is `4`, and `2^3^2` is `64`. A sign after `^`
applies to that operand: `2^-2^2` is `0.0625`. Negative bases require integer
exponents; zero to a negative power errors, and native `0^0` is `1`. See the
[numeric contract](numeric-expressions.md) for domains and limits. No JavaScript
`eval` is used.

| Function | Contract                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------ |
| `ABS(x)` | One numeric argument; returns its absolute value.                                                      |
| `INT(x)` | One numeric argument; floors toward negative infinity. `INT(-1.6)` is `-2`.                            |
| `RND()`  | No arguments; returns a number `>= 0` and `< 1`. The host supplies randomness so tests can control it. |

`INKEY$()` consumes one queued logical key or returns `""`;
`KEYDOWN(name)` returns numeric 1 or 0 for a held logical key. The latter
requires a string name, case-insensitively from `A`..`Z`, `0`..`9`, `UP`, `DOWN`,
`LEFT`, `RIGHT`, `ENTER`, and `SPACE`. Escape remains Stop. See the
[keyboard contract](keyboard.md) for focus, queue limits, host capabilities
and diagnostics. Both functions are reserved and require keyboard support.

Parentheses are required in all function calls. Unknown functions, wrong arity,
and wrong argument types are errors. The runtime starts each run with fresh
variables; it does not promise to restart the host's random sequence.

Comparisons appear only in `IF`. Numbers support `=`, `<>`, `<`, `<=`, `>`, `>=`.
Strings support exact, case-sensitive `=` and `<>`. Mixed types are errors.
There is no Boolean variable type, comparison-as-value, chained comparison,
`AND`, `OR`, or `NOT` in the current native dialect.

## Statements

In these forms, `expression` follows the rules above, `variable` is a name, and
`line` is a literal valid line label. Square brackets describe optional syntax;
they are not written in a program.

| Statement        | Form and behavior                                                        |
| ---------------- | ------------------------------------------------------------------------ |
| Assignment       | `[LET] variable = expression`; `LET` is optional.                        |
| Output           | `PRINT [items] [;]`; expression/separator rules below.                   |
| Formatted output | `PRINT USING template, value [, value ...] [;]`; integer subset below.   |
| Input            | `INPUT ["prompt";] variable`; one target only.                           |
| Wait             | `WAIT expression`; yield for a duration in milliseconds.                 |
| Conditional jump | `IF expression comparison expression THEN line`.                         |
| Jump             | `GOTO line` or `GO TO line`; literal targets only.                       |
| Loop start       | `FOR variable = expression TO expression [STEP expression]`.             |
| Loop end         | `NEXT variable`; the variable is required.                               |
| Comment          | `REM [any remaining text]`.                                              |
| Pen color        | `COLOR expression`; select an integer palette index from 0 through 15.   |
| Pixel            | `PSET expression,expression`; draw one logical pixel.                    |
| Segment          | `LINE expression,expression,expression,expression`; draw a line segment. |
| Circle           | `CIRCLE expression,expression,expression`; draw a circle outline.        |
| Clear            | `CLS`; asks the host to clear text and graphics.                         |
| Completion       | `END`; finishes the run normally and returns control to its host.        |

Unknown statements, extra arguments, and unconsumed tokens are syntax errors.
`CLS` and `END` take no operands. Keywords inside strings are ordinary text.

### Assignment and common classic spellings

Scalar assignment accepts either `LET SCORE = 3` or `SCORE = 3`, including
string variables. `GO TO` is an alias for `GOTO` at statement position; GO
remains an ordinary variable in `GO=2`, `LET GO=2` and `PRINT GO`.
These documented spellings are compatible native extensions, not a historical
profile or permission to guess keywords. PRI, INP, GOT, general keyword splitting
and compact label/statement text remain unsupported. Source spelling and spans
are retained; `LIST` and source export do not insert LET or collapse GO TO.

### Graphics

`COLOR`, `PSET`, `LINE`, and `CIRCLE` use a fixed 320 × 200 canvas and a
16-color palette. Numeric arguments evaluate left to right; coordinates and
radii round to the nearest safe integer, with halves toward positive infinity.
The complete syntax, diagnostics, palette and optional host capability are
defined in the [graphics contract](graphics.md). Hosts without drawing support,
including the terminal, report `GRAPHICS_UNAVAILABLE` at an executed graphics
statement.

### WAIT

`WAIT expression` requires a finite number from 0 through 2147483647, inclusive.
Positive fractions round upward to whole milliseconds; zero still yields to a
host task. Negative or larger values report `INVALID_WAIT_DURATION`. Timing is
approximate, and Stop cancels the pending timer. Use the asynchronous library
methods; synchronous execution reports `ASYNC_WAIT_REQUIRED`. The browser
presents buffered drawing before starting the timer. See
[WAIT and animation](wait.md) for host and debugger contracts.

### PRINT

`PRINT USING` accepts the [bounded native integer-field subset](print-using.md):
a string template with `#` fields and exactly one safe integer per field,
comma-separated values, and optional final semicolon. Fields align right; a
negative sign consumes field width. Unsupported masks/fractions/overflow/reuse
fail explicitly. USING remains an ordinary name outside this contextual form.
This does not enable a historical profile or change unformatted number spacing.

Adjacent complete expressions may omit a semicolon when either immediately
neighboring item has string type: `PRINT "YOU MADE" M "JUMPS"`, `PRINT A$ B$`,
or `PRINT "value=" A(1)`. Parse each expression greedily: `PRINT 1 -2` is still
subtraction, and an identifier followed by parentheses is still array access,
even with whitespace. Numeric-only `PRINT 1 2` remains invalid; use semicolons.
This native extension adds no numeric padding, zones or historical profile.
See [adjacent items](print-adjacency.md) for source/AST rules and examples.

Evaluate expressions left to right. A semicolon joins their displayed values
without inserting a space. By default, append one newline; a trailing semicolon
suppresses it. Blank `PRINT` emits a newline. Empty items, a leading semicolon,
and comma-based output zones are not supported.

Strings display their contents without quotes. Numbers use their ordinary
finite JavaScript decimal representation with no padding; negative zero displays
as `0`. Large/small results may use exponent notation when displayed, even though
exponent literals are not accepted in source or numeric input.

```bas
10 LET SCORE = 3
20 PRINT "Score: "; SCORE
30 PRINT "Hello, ";
40 PRINT "world!"
50 PRINT
```

The first two output lines are `Score: 3` and `Hello, world!`, followed by a blank
line. `CLS` does not reset variables, change the program, or move the next line.

### INPUT

An optional prompt must be a string literal followed by `;`. The host displays
that literal followed by `? `; without a prompt it displays `? `. Input consumes
one complete line without its line ending. String input preserves spaces and
needs no quotes.

For numeric input, trim surrounding spaces/tabs and require a complete signed
or unsigned decimal value using the literal forms above. Empty, partial,
non-finite, or otherwise invalid input produces a useful retry message and asks
again without assigning the target. Do not use prefix parsing such as accepting
`12oops` as `12`.

Execution waits for input without blocking the host. EOF before a value arrives
ends the run with a source-located input-ended diagnostic; file mode exits with
an error status. Cancellation ends the pending request without assigning it.
Late callbacks cannot resume an old or replacement run. While input is pending,
text such as `RUN` or `EXIT` belongs to the program's input, not the editor.

### IF and GOTO

`IF` contains exactly one comparison. If true, execute the target line next;
otherwise, continue to the next numbered line. Both operands are evaluated.
`THEN` accepts a literal label only, not an inline statement. There is no `ELSE`
or block `IF`.

`GOTO` and the spaced spelling `GO TO` always jump. Complete-program validation checks every literal target,
including those in unreachable lines, before executing any statements.

```bas
10 INPUT "Guess"; N
20 IF N < 10 THEN 50
30 PRINT "Ten or more"
40 END
50 PRINT "Less than ten"
```

### FOR and NEXT

The loop variable must be numeric. Match each `FOR` to a named `NEXT` by lexical
nesting in numeric program order. Mismatched, missing, or extra partners fail
complete-program validation, even when they would be unreachable.

On entering `FOR`, evaluate start, end, and step once using the current state;
they must be finite numbers. The default step is `1`. A zero step is an error.
After successful evaluation, assign the start to the loop variable. Bounds are
inclusive: a positive step runs while the variable is `<= end`, and a negative
step runs while it is `>= end`. An initially false bound skips to the statement
after `NEXT`, leaving the variable at its start value.

`NEXT` increments the variable by the captured step and checks the bound. If the
bound still holds, resume after `FOR`; otherwise discard that loop frame and
continue after `NEXT`. The variable retains its final value, including the value
that passed the bound. Increment overflow is a non-finite-result error.

Nested loops use separate frames. Executing a nested `FOR` with an already active
loop variable is an error. `LET` and `INPUT` may change an active loop variable;
the next `NEXT` uses that value with the captured step and bound.

A loop body includes the statements after its `FOR` through its `NEXT`:

- A jump into that body requires its loop frame already to be active. Otherwise
  report an error instead of inventing a frame.
- A jump out discards only frames whose bodies do not contain the destination.
  An inner-to-outer jump keeps the outer frame.
- The `FOR` header is outside its own body. Jumping back to that header discards
  its old frame and enters it anew. Surrounding active loops still apply.
- `END`, error, cancellation, and a new run clear all control-flow frames.

## Interactive session and files

Session commands are unnumbered and case-insensitive. They are available at the
idle prompt. Numbered statements edit the program; they do not run immediately.
Only these session commands are accepted in the idle terminal prompt in the current native dialect.

| Input               | Behavior                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `10 PRINT "Hello"`  | Parse the line and insert or replace label 10.                               |
| `10`                | Delete label 10 if present. Deleting an absent label is harmless.            |
| Blank input         | Do nothing and show the prompt again.                                        |
| `RUN`               | Validate and execute a fresh snapshot from the first numbered line.          |
| `LIST`              | Display the complete stored source in numeric order.                         |
| `NEW`               | Confirm discarding unsaved edits, then clear source and filename.            |
| `LOAD "path.bas"`   | Read and completely validate a candidate, then replace source if authorized. |
| `SAVE ["path.bas"]` | Save the source to a supplied filename, or the current filename.             |
| `EXIT`              | Confirm discarding unsaved edits, then close the terminal session.           |

`SAVE` without either a supplied or current filename reports a useful error.
Paths are quoted strings, including when they contain spaces; doubled quotes
represent a quote in a path. Session commands reject unexpected trailing tokens.

### Validation and preservation of work

Per-line editing checks lexical and statement syntax only. It accepts unresolved
forward jumps and a `FOR` whose `NEXT` has not yet been entered. An invalid edit
leaves the previous line and dirty state unchanged.

`RUN` and `LOAD` perform complete validation: syntax, duplicate labels in files,
all literal jump targets, and loop pairing. Type/value checks that depend on
execution remain runtime checks. An invalid `RUN` leaves stored source intact.
An invalid or unreadable `LOAD` leaves source, current filename, and dirty state
unchanged. No part of a candidate file executes during validation or loading.

Source edits mark the program dirty. Running a program or changing its variables
does not change that flag. Successful `LOAD`/`SAVE` clears it; successful `NEW`
starts a clean empty program. Unchanged edits need not mark a clean program dirty.

`NEW`, `LOAD`, and `EXIT` ask before discarding dirty work. `SAVE` asks before
overwriting any existing destination, including the current filename. Confirm
with `y` or `yes` (case-insensitive); other replies cancel. EOF or Ctrl+C during
a confirmation cancels that operation. A cancelled operation preserves source,
filename, dirty state, and any destination file.

`SAVE` writes the current source, including syntactically valid but incomplete
edits, to a temporary file in the destination directory. Replace the destination
only after the write succeeds. On failure, retain the prior destination and
session state and clean up the temporary file. Because `LOAD` requires a complete
program in 1.0, a saved program with unresolved jumps or loops must be completed
before it can be loaded; saving alone is not a claim that it is runnable.

### Runs, interruption, and EOF

Every `RUN` starts fresh variables, loop frames, and execution state. Runs and
runtime instances do not share mutable language state. Run status distinguishes
running, waiting for input, halted, and error. Empty programs finish normally.

Execute in short yielding batches. Ctrl+C must stop both a busy loop and pending
`INPUT`, preserve source, and return to the interactive prompt. At an idle prompt,
Ctrl+C cancels only the current entry. Starting a new run invalidates callbacks,
queued output, and input work from older runs. An optional instruction limit for
automation reports a source-located error, resets per run, and preserves source.

At idle EOF, a clean session exits normally. If source is dirty, write a warning
and a complete copy of the stored BASIC source to stderr before a nonzero exit;
do not silently discard the only copy. EOF during program input follows the
`INPUT` rule above, followed by the host's terminal-EOF handling if applicable.

File mode (`basic program.bas`) uses the same parser/runtime as `RUN`, accepts
program input, and does not open an editor prompt. Successful completion exits
`0`; file/syntax/runtime/input-EOF errors exit `1`; Ctrl+C exits `130`.
Extra arguments print usage and retain the legacy status `9`.
Program output goes to stdout and diagnostics to stderr, with no unsolicited
file-mode banner. Only the terminal host owns process exit and terminal handles.

## Diagnostics

Errors identify the BASIC label and a useful 1-based column in the original
source. When a label itself is invalid, identify the physical file line/column
instead. Return structured diagnostics so each host can display them consistently.
An example presentation is `Line 20, column 10: Undefined variable SCORE`.

| Source or action                                | Expected result                                            |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `10abc PRINT "Hello"`                           | Invalid line label; no partial numeric parsing.            |
| Two file lines labelled `10`                    | Duplicate-label error before execution.                    |
| `10 PRINT "unfinished`                          | Unterminated string with a source location.                |
| `10 LET A = "text"`                             | Numeric/string type error.                                 |
| `10 PRINT UNKNOWN`                              | Undefined-variable error when executed.                    |
| `10 PRINT 1 / 0`                                | Division-by-zero error.                                    |
| `10 IF A < 1 THEN PRINT "x"`                    | Unsupported inline `THEN` syntax.                          |
| `10 GOTO 999` with no label 999                 | Missing target during full validation.                     |
| Unpaired `FOR` in an edit                       | Edit accepted; `RUN`/`LOAD` reject the incomplete program. |
| `10 FOR I = 1 TO 3 STEP 0` with matching `NEXT` | Zero-step error on execution.                              |

Syntax/runtime failure ends the current run in a usable error state. It does not
clear stored source, terminate the interactive host, or execute later statements.

## Acceptance programs

These programs are executable acceptance fixtures for the implemented dialect.
All three execute through the file/runtime path and the stored editor. `LOAD` and
`SAVE` support complete-program round trips through the terminal session; `SAVE`
also preserves incomplete edits.

### Greeting

```bas
10 INPUT "What is your name"; NAME$
20 PRINT "Hello, "; NAME$; "!"
30 END
```

### Times table

```bas
10 INPUT "Which times table"; N
20 FOR I = 1 TO 10
30 PRINT I; " x "; N; " = "; I * N
40 NEXT I
50 END
```

### Guessing game

```bas
10 LET SECRET = INT(RND() * 100) + 1
20 LET TRIES = 0
30 INPUT "Guess a number from 1 to 100"; GUESS
40 LET TRIES = TRIES + 1
50 IF GUESS < SECRET THEN 100
60 IF GUESS > SECRET THEN 120
70 PRINT "Correct in "; TRIES; " tries!"
80 END
100 PRINT "Too low."
110 GOTO 30
120 PRINT "Too high."
130 GOTO 30
```

With injected `RND() = 0.41`, the secret is 42. Inputs 20, 80, and 42 must produce
low/high feedback and success in three tries. A new run starts the count afresh.

## Migration from the legacy dialect

The earlier `ABS` and `INT` standalone commands printed their result from a
quoted argument. The current runtime replaces them with expression functions:

| Earlier syntax   | Current syntax        |
| ---------------- | --------------------- |
| `10 ABS "-3.14"` | `10 PRINT ABS(-3.14)` |
| `20 INT "-1.6"`  | `20 PRINT INT(-1.6)`  |

The old standalone forms are no longer aliases. Files now validate all syntax
before execution and run in numeric label order; `END` finishes a run instead of
exiting the application. Numbered REPL entries edit stored source; `RUN` executes
it, and blank input is harmless. `NEW` and `EXIT` ask before discarding unsaved
source. The library's legacy `readLine` methods retain immediate execution; they
are separate from the terminal session.

Historical array defaults/conversions, `DATA`/`READ`, `GOSUB`/`RETURN`, user-defined functions, general immediate
statements, multiple statements per line, a broad string library, and sound are
outside the current implementation, but corpus-required features are now
release blockers under [#114](https://github.com/jesselpalmer/BASIC/issues/114).
The [browser playground](playground.md) supports the
[graphics extension](graphics.md); terminal hosts support text programs.

Sources: [implementation backlog](https://docs.google.com/document/d/1V02IrDkBeG98QwgzW1Rx6VgZe4eVkTmSfTdNCD3tUIA)
and [cleanup, MVP, and graphics roadmap](https://docs.google.com/document/d/1onRiRqbrjoVH5w7ByZ_ylk_ZhixE3OqN-nPDYBHImdk).
