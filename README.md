[![npm](https://img.shields.io/npm/dw/node-basic-lang.svg)](https://www.npmjs.com/package/node-basic-lang) [![Bun CI](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml/badge.svg)](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml)

# BASIC

BASIC interpreter

## Development roadmap

The [v0.1 language and session contract](docs/language-v0.1.md) defines the
planned terminal MVP, including expressions, variables, control flow, and
stored-program editing. Those features are being implemented incrementally;
the commands below describe the current executable.

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
strict types, typed lint, the behavioral suite with coverage, and a packed
installation in a temporary Bun consumer. The package check verifies quiet
ES module/CommonJS imports, parser/evaluator exports, and the installed executable.

Use `bun run format` to apply formatting and `bun test` for a quick test run.
See [quality checks and coverage](docs/quality-checks.md) for the complete commands,
measured baseline, and coverage limitations.

## Installation

This checkout requires Bun and ships TypeScript source. Install it locally with:

```bash
bun install -g .
```

The package remains named `node-basic-lang`; the public npm registry
(`https://registry.npmjs.org/`) is the intended publication destination. No release
has been published for this migration. Installing the existing registry release
still retrieves the earlier JavaScript implementation. GitHub Packages is unused.

## Executing files

1. Create a BASIC program using the [supported commands](#supported-commands) below. Make sure that the file ends in `.bas`.

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

Make sure that you enter a unique line number for each command, just like you would a normal file. See [supported commands](#supported-commands) below for a list of commands you can use.

Numbered entries still execute immediately in entry order and retain variables
until `END` or an error. This differs from files, which validate completely and
execute in numeric label order. Stored-program editing is a later feature.

`END` finishes the current run and returns to the prompt. You can then enter
another program, reusing its line numbers. For now, a blank line or EOF closes
the session; stored-program editing and `EXIT` are planned for v0.1.

Errors are reported to stderr. A file error stops execution with a nonzero exit
code; an interactive command error resets the current run and leaves the prompt
usable. Ctrl+C closes a waiting terminal with exit code 130.

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
this checkout without building; this change does not update the published package.

## Supported commands

| Statement                                       | Behavior                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `LET name = expression`                         | Assign a number, or a string to a name ending in `$`.                                                         |
| `INPUT ["prompt";] name`                        | Read a number, or literal text for a `$` name; invalid numeric input retries.                                 |
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
non-finite numbers produce source-located errors. Stored editor commands are
not yet implemented.

The [parser API](docs/parser.md) builds immutable programs sorted by numeric
label, with syntax trees for expressions, `LET`, `PRINT`, `REM`, `CLS`, and `END`.
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
Ctrl+C cancels the request and exits the current CLI session with code 130.

For library programs with `INPUT`, use `await basic.runAsync(source, {signal})`.
`stepAsync` and `readLineAsync` are also available, and `basic.cancel()` stops a
pending request. The existing synchronous methods remain available for programs
without input; executing `INPUT` through them reports `ASYNC_INPUT_REQUIRED`.
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
`Basic.run`/`runAsync`/`reset`. The current immediate-entry REPL reports
`PROGRAM_REQUIRED`; stored-program editing follows in #42. Runs do not yet
yield to timers or impose instruction limits on busy loops (#41). Use bounded
`step()` calls while developing an unfinished loop.

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
