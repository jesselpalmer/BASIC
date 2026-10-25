[![npm](https://img.shields.io/npm/dw/node-basic-lang.svg)](https://www.npmjs.com/package/node-basic-lang) [![Bun CI](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml/badge.svg)](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml)

# BASIC

A small line-numbered BASIC interpreter for Bun, with a terminal editor and an
embeddable TypeScript API. The v0.1.0 release candidate implements expressions,
variables, input, branching, loops, and stored-program editing and persistence.

The [v0.1 language reference](docs/language-v0.1.md) is the complete supported
dialect. This is a deliberately limited text-programming language, without
QBasic or GW-BASIC compatibility, arrays, subroutines, or sound. The browser
also supports a fixed 320×200 graphics surface; see the [graphics guide](docs/graphics.md).
See the [changelog](CHANGELOG.md) and [release checklist](docs/release-checklist.md).

## Quick start

Development and CI use **Bun 1.4.4** (see `.bun-version` and `package.json`).
Install [Bun](https://bun.com/docs/installation), then from a local checkout:

```bash
bun install --frozen-lockfile
bun run check
bun start
# Or execute a file:
bun start game.bas
```

Source and tests use strict TypeScript. Bun runs the source directly; no build
step is required. `bin/basic` starts the CLI while `src/index.ts` exports the
interpreter, parser, evaluator, and public types without opening a terminal. The core and
parser contain no Bun-specific runtime APIs, allowing future browser hosts.

CI checks the frozen lockfile and runs the same `bun run check` command: formatting,
strict types, typed lint, coverage, shuffled test order, and packed installations
in temporary Bun consumers on Linux and macOS. The package check exercises shared
library scenarios through ESM/CommonJS, public types, the local executable, and
an isolated global installation.

Use `bun run format` to apply formatting and `bun test` for a quick test run.
See [quality checks and coverage](docs/quality-checks.md) for the complete commands,
coverage policy and limitations. The [architecture guide](docs/architecture.md)
explains module ownership and invariants; the [maintainability audit](docs/maintainability-audit.md)
records the review findings and their verification.

## Browser playground

From a checkout, build and serve the static playground:

```sh
bun run build:playground
bun run serve:playground
```

Open `http://127.0.0.1:3000`. Choose an example, edit its source, and run it;
use the input field when prompted. Stop or Escape cancels a busy loop or pending
input. Edits apply to the next run. The interpreter runs entirely in the browser
through the same parser and runtime as the CLI. No account or application server
is required. Edits restore locally after reload; import and export `.bas` files
to move programs between the browser and terminal. See the
[playground guide](docs/playground.md) for controls and tests.

Choose **A little landscape** to try graphics. `COLOR`, `PSET`, `LINE`, and
`CIRCLE` use a 16-color palette; `CLS` clears text and drawing. The canvas scales
on screen while BASIC coordinates stay fixed. Graphics statements need a browser
or library host with drawing support; the terminal reports an unsupported-host
diagnostic.

Choose **Bouncing ball** to animate that surface with `WAIT milliseconds`.
Stop or Escape ends the animation; rerunning starts it fresh. WAIT also works
in text-only Bun programs. See [timing and animation](docs/wait.md) for duration
limits, approximate timing, cancellation, and debugger behavior.

Choose **Arrow-key marker** to try held-key controls. Run it, then click the
canvas or focus it with Tab and use the arrows. `INKEY$()` reads queued presses;
`KEYDOWN("UP")` observes held keys. See [keyboard input](docs/keyboard.md) for
focus rules, logical names, and supported hosts.

## Installation

Requires **Bun 1.4.4 or newer** on your `PATH`; the candidate ships TypeScript
source and needs no build step. Node.js alone is not a supported runtime. From
a checkout, install the `basic` command with:

```bash
bun install -g .
```

Alternatively, prepare and install a local release archive:

```bash
bun pm pack --filename node-basic-lang-0.1.0.tgz --ignore-scripts
bun install --global ./node-basic-lang-0.1.0.tgz
```

Ensure Bun's global executable directory is on your `PATH`. The package name is
`node-basic-lang`; its command is `basic`. This candidate does not publish or tag
a release. The public npm registry (`https://registry.npmjs.org/`) is the intended
publication destination; local installation does not require registry publication.
The existing registry release is the earlier JavaScript implementation, so
`bun install --global node-basic-lang` does not install this unpublished candidate.

## Executing files

1. Create a text file using the [supported commands](#supported-commands) below. Use the conventional `.bas` extension.

2. Run the BASIC program that you created

```bash
basic <program name>.bas
```

Example:

```bash
basic game.bas
```

## Using the REPL

You can use the REPL just by running the following command in the terminal:

```bash
basic
```

Numbered entries edit stored source; they execute only when you enter `RUN`.
Re-enter a label to replace that line, or enter its label alone to delete it.
`LIST` prints source in numeric order. Forward jumps and incomplete loops can be
entered incrementally; `RUN` validates the complete snapshot before any effects.

```text
10 PRINT "Hello"
LIST
RUN
EXIT
```

`NEW` clears the program, and `EXIT` closes the session. Both ask before
discarding unsaved work; only `y` or `yes` confirms. A blank entry does nothing.
EOF with unsaved source prints a warning and the complete source to stderr,
then exits with code 1 so you can recover your program.

`SAVE "my program.bas"` writes source without running it; `SAVE` reuses the current
filename. Existing destinations always require overwrite confirmation.
`LOAD "my program.bas"` validates a complete candidate, then asks before
discarding unsaved edits and replacing source. Failed or cancelled operations preserve
the current program and filename. Paths use doubled quotes for a literal quote.

Saving accepts incomplete edits, but loading requires resolved jump targets and
paired loops. New files are installed without clobbering a competing writer;
approved overwrites replace the destination atomically. Temporary files are
cleaned on failure, and post-install cleanup failures are reported as warnings.
See the [terminal guide](docs/terminal.md) for persistence and interruption rules.

Every `RUN` starts fresh variables and control flow while retaining source.
Errors and Ctrl+C return to a usable prompt. At an idle prompt, Ctrl+C discards
only the unfinished entry. During BASIC `INPUT`, text belongs to the running
program, even when the answer is `RUN` or `EXIT`. File-mode Ctrl+C exits 130.
See the [terminal session guide](docs/terminal.md) for editing, confirmation,
EOF recovery, and interrupt behavior.

## Embedding the interpreter

```js
import {Basic} from 'node-basic-lang';
const basic = new Basic({write: (text) => process.stdout.write(text)});
basic.run('10 PRINT "Hello"\n20 END');
```

CommonJS callers on Bun can also use
`const {Basic} = require('node-basic-lang');`.
Imports and construction are quiet. `END` returns normally to the caller, and
each `run(source)` starts fresh. Source is fully validated before any output,
then executed in numeric label order. The default host discards output; provide the
callbacks you need. See [the host API](docs/interpreter-host.md) for lifecycle,
async input, randomness, and current limitations. These exports are available in
the candidate without building.

## Errors and interruption

File execution writes program output to stdout and diagnostics to stderr, without
a version banner or JavaScript stack trace. Syntax, duplicate labels, missing
jump targets, and unmatched loops are checked before any program effects. Runtime
errors identify the BASIC label and column, for example
`Line 10, column 11: Cannot divide by zero`. An editor error preserves source and
returns to the prompt.

| File-mode result                          | Exit status |
| ----------------------------------------- | ----------- |
| Normal completion, including `END`        | `0`         |
| File, syntax, runtime, or input-EOF error | `1`         |
| Ctrl+C interruption                       | `130`       |
| Extra command-line arguments              | `9`         |

Ctrl+C also interrupts busy loops and pending input. The editor retains the
program; an idle Ctrl+C discards only the unfinished entry. See
[terminal behavior](docs/terminal.md) for confirmations and EOF recovery.

## Supported commands

| Statement                                       | Behavior                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `LET name = expression`                         | Assign a number, or a string to a name ending in `$`.                                                         |
| `INPUT ["prompt";] name`                        | Read a number, or literal text for a `$` name; invalid numeric input retries.                                 |
| `WAIT milliseconds`                             | Yield the async run for 0..2147483647 ms; positive fractions round upward.                                    |
| `IF left comparison right THEN line`            | Jump when one comparison is true; otherwise continue to the next line.                                        |
| `GOTO line`                                     | Jump to an existing literal line label.                                                                       |
| `FOR variable = start TO end [STEP expression]` | Enter an inclusive numeric loop; the default step is 1.                                                       |
| `NEXT variable`                                 | Increment the matching loop variable and repeat or finish the loop.                                           |
| `PRINT [expression [; expression]... [;]]`      | Join values without added spaces; a trailing semicolon suppresses the newline. Blank `PRINT` emits a newline. |
| `CLS`                                           | Ask the host to clear the display.                                                                            |
| `REM [text]`                                    | Ignore the rest of the line.                                                                                  |
| `END`                                           | Complete the run and return to the host. End of program also completes normally.                              |

Labels must be decimal integers from 1 through 65535, followed by a space or
tab. Leading zeros are allowed: `010` and `10` identify the same line. Leading
spaces/tabs, lowercase commands, and LF/CRLF files are supported.

Expressions support numbers, strings, case-insensitive variables, parentheses,
unary signs, and `+`, `-`, `*`, `/` with ordinary arithmetic precedence. `+` also
concatenates two strings. There is no automatic conversion between strings and
numbers, and reading an undefined variable is an error.

`ABS(x)` returns a number's absolute value, `INT(x)` floors toward negative
infinity, and `RND()` returns a host-provided number in `[0, 1)`. Double a quote
inside a string (`10 print "She said ""hello""."`); backslashes and whitespace
remain literal. Malformed syntax, incompatible values, division by zero, and
non-finite numbers produce source-located errors. The terminal also implements
`RUN`, `LIST`, `NEW`, `LOAD`, `SAVE`, and `EXIT`; these are session commands rather
than BASIC program statements.

The [parser API](docs/parser.md) builds immutable programs sorted by numeric
label, with syntax trees for supported statements and expressions.
It is available separately through `parseLine`, `parseProgram`, and
`validateProgram`. The separate [evaluator API](docs/evaluator.md) adds typed
variables, arithmetic, string concatenation, and `ABS`, `INT`, and `RND` function
calls over parsed expressions. `Basic` and the CLI use this same parser/evaluator
and statement runtime. `basic.reset(sourceOrProgram)` prepares a fresh snapshot
without executing; `basic.step()` executes one statement and returns immutable
status, current/next source locations, and diagnostics. See the
[runtime API](docs/interpreter-host.md) for stepping and reruns.

## Sample file

```bas
10 CLS
20 REM "BASIC HELLO WORLD PROGRAM"
30 PRINT "HELLO WORLD"
40 PRINT "HELLO WORLD 2X"
50 PRINT "HELLO WORLD 3X"
60 PRINT ABS(-3.14)
70 PRINT INT(1.6180)
80 END
```

## Interactive programs

Files and REPL entries can now request input:

```bas
10 INPUT "What is your name"; NAME$
20 PRINT "Hello, "; NAME$; "!"
30 INPUT "Age"; AGE
40 PRINT "Next year: "; AGE + 1
```

The host displays `What is your name? ` (or `? ` without a prompt). String
answers preserve whitespace and require no quotes. Numeric answers must be
complete finite signed decimals, with surrounding spaces/tabs allowed; invalid
answers receive a retry message. EOF during input fails with a source location;
Ctrl+C cancels the run and returns to the interactive editor. In file mode it
exits with code 130.

For library programs with `INPUT` or `WAIT`, use `await basic.runAsync(source, {signal})`.
`stepAsync` and `readLineAsync` are also available, and `basic.cancel()` stops a
pending input, WAIT, or a yielding run. The existing synchronous methods remain available for programs
without these asynchronous statements; executing them synchronously reports
`ASYNC_INPUT_REQUIRED` or `ASYNC_WAIT_REQUIRED`, respectively.
The [runtime API](docs/interpreter-host.md) documents waiting, cancellation, and
safe replacement of an active run.

## Branching and a guessing game

In complete programs, `IF` supports numeric `=`, `<>`, `<`, `<=`, `>`, `>=`,
and exact, case-sensitive string `=`/`<>`. Types must match. `THEN` and `GOTO`
take literal decimal labels from 1 through 65535; every target must exist before
the program runs, including in unreachable statements. There is no `ELSE`,
inline statement after `THEN`, comparison-as-value, or Boolean expression syntax.

Try the [guessing game](examples/guess.bas) from a checkout:

```sh
bun start examples/guess.bas
```

`IF` and `GOTO` require a complete program passed to the file CLI or
`Basic.run`/`runAsync`/`reset`, or entered in the terminal and executed with `RUN`.
The legacy library `readLine` adapter still reports `PROGRAM_REQUIRED` for these
commands. Async runs now yield
in short batches, so Ctrl+C can interrupt busy file programs. Library callers can
set a per-run instruction limit and inject a scheduler; see
[responsive execution](docs/execution.md). Synchronous `run()` remains blocking;
use bounded `step()` calls or `runAsync` while developing an unfinished loop.

Numeric `FOR`/`NEXT` loops support nesting, descending steps, and zero iterations.
Bounds and step evaluate once per entry; jumps preserve only the loop frames
that contain their destination. See [loop semantics](docs/loops.md) and run
`bun start examples/times-table.bas` for an interactive example.

## Migration from legacy commands

Standalone `10 ABS "-3.14"` and `20 INT "-1.6"` are no longer supported. Use
`10 PRINT ABS(-3.14)` and `20 PRINT INT(-1.6)` instead. Files now run in numeric
label order and validate all syntax and duplicate labels before any effects,
including source after `END`. Runtime expressions after `END` are not evaluated.
`run()` and `step()` return the richer immutable state documented above.
