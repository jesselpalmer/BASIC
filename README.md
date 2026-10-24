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
interpreter, parser, and public types without opening a terminal. The core and
parser contain no Bun-specific runtime APIs, allowing future browser hosts.

CI checks the frozen lockfile and runs the same `bun run check` command: formatting,
strict types, typed lint, the behavioral suite with coverage, and a packed
installation in a temporary Bun consumer. The package check verifies quiet
ES module/CommonJS imports, parser exports, and the installed executable.

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
each `run(source)` starts fresh. The default host discards output; provide the
callbacks you need. See [the host API](docs/interpreter-host.md) for lifecycle,
async input, randomness, and current limitations. These exports are available in
this checkout without building; this change does not update the published package.

## Supported commands

`ABS` - Prints out the absolute value of a number.  
`CLS` - Clears the console.  
`INT` - Prints out an integer by rounding any decimal number down.  
`PRINT` - Prints lines to the console.  
`REM` - Comments for the user. The interpreter ignores these lines.  
`END` - Completes the current BASIC run and returns to its host.

Labels must be decimal integers from 1 through 65535, followed by a space or
tab. Leading zeros are allowed: `010` and `10` identify the same line. Leading
spaces/tabs, lowercase commands, and LF/CRLF files are supported.

`PRINT`, `ABS`, and `INT` currently take exactly one quoted string. Double a quote
inside a string (`10 print "She said ""hello""."`); backslashes and whitespace
remain literal. `REM` ignores everything after the keyword, including unmatched
quotes. `CLS` and `END` take no arguments. Malformed labels, unterminated strings,
unexpected characters, and trailing operands now produce located errors instead
of being partially interpreted or silently ignored.

The [parser API](docs/parser.md) builds immutable programs sorted by numeric
label, with syntax trees for expressions, `LET`, `PRINT`, `REM`, `CLS`, and `END`.
It is available separately through `parseLine`, `parseProgram`, and
`validateProgram`. It does not execute the new syntax. The CLI and `Basic` still
use the legacy execution path above; expression evaluation, execution of parsed
programs, and stored editing follow in later tickets.

## Sample file

```bas
10 CLS
20 REM "BASIC HELLO WORLD PROGRAM"
30 PRINT "HELLO WORLD"
40 PRINT "HELLO WORLD 2X"
50 PRINT "HELLO WORLD 3X"
60 ABS "-3.14"
70 INT "1.6180"
80 END
```

Legacy `ABS` and `INT` arguments must be complete finite signed decimals,
including forms such as `"-.5"` and `"1."`. Trailing junk, hexadecimal/binary,
exponent spellings, empty arguments, and non-finite values are rejected. ABS
no longer accepts only the numeric prefix of a malformed quoted argument.
