[![npm](https://img.shields.io/npm/dw/node-basic-lang.svg)](https://www.npmjs.com/package/node-basic-lang) [![Node.js CI](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml/badge.svg)](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml)

# BASIC

BASIC interpreter

## Development roadmap

The [v0.1 language and session contract](docs/language-v0.1.md) defines the
planned terminal MVP, including expressions, variables, control flow, and
stored-program editing. Those features are being implemented incrementally;
the commands below describe the current executable.

For a local checkout, install dependencies with `npm ci`, run `npm run build`,
then run `npm test` and `npm run lint`. Rebuild after source changes: `bin/basic`
loads the checked-in `lib/main.js` CLI bundle. The separate `lib/index.js` bundle
exports the interpreter without starting a terminal. CLI regression tests
exercise the executable, including the sample below.

## Installation

1. You need to have at least version`v14.0.0` of [node.js](https://nodejs.org/en/) installed.

2. Install the `node-basic-lang` library globally:

```bash
npm install -g node-basic-lang
```

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
const {Basic} = require('node-basic-lang');
const basic = new Basic({write: (text) => process.stdout.write(text)});
basic.run('10 PRINT "Hello"\n20 END');
```

Imports and construction are quiet. `END` returns normally to the caller, and
each `run(source)` starts fresh. The default host discards output; provide the
callbacks you need. See [the host API](docs/interpreter-host.md) for lifecycle,
async input, randomness, and current limitations. These exports are available in
this checkout after building; this change does not update the published package.

## Supported commands

`ABS` - Prints out the absolute value of a number.  
`CLS` - Clears the console.  
`INT` - Prints out an integer by rounding any decimal number down.  
`PRINT` - Prints lines to the console.  
`REM` - Comments for the user. The interpreter ignores these lines.  
`END` - Completes the current BASIC run and returns to its host.

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
