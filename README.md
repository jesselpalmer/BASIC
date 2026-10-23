[![npm](https://img.shields.io/npm/dw/node-basic-lang.svg)](https://www.npmjs.com/package/node-basic-lang) [![Node.js CI](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml/badge.svg)](https://github.com/jesselpalmer/BASIC/actions/workflows/node.js.yml)

# BASIC

BASIC interpreter

## Development roadmap

The [v0.1 language and session contract](docs/language-v0.1.md) defines the
planned terminal MVP, including expressions, variables, control flow, and
stored-program editing. Those features are being implemented incrementally;
the commands below describe the current executable.

Development and CI use **Node.js 24.x** (see `.nvmrc` and `package.json`).
Use the latest Node 24 patch release. From a local checkout:

```bash
npm ci
npm run lint
npm test
npm run test:package
npm start
# Or execute a file:
npm start -- game.bas
```

The source runs as native ES modules. There is no build step: `bin/basic` loads
the CLI, while `src/index.js` exports the interpreter without starting a terminal.
Source edits take effect on the next invocation. Jest runs the source without
transforms; its test command enables Node's experimental VM modules, so a VM
modules warning during tests is expected. The CLI needs no experimental flags.

CI runs a clean install, lint, the test suite, and the package smoke check. The
latter packs a tarball and installs it into a temporary consumer, then checks
ES module/CommonJS imports and the installed executable. It does not publish.

## Installation

1. Install [Node.js](https://nodejs.org/en/) **24.x** for this checkout.

2. Install the `node-basic-lang` library globally:

```bash
npm install -g node-basic-lang
```

The intended publication registry is the public npm registry,
`https://registry.npmjs.org/`, for the unscoped `node-basic-lang` package.
GitHub Packages is not used. The command above installs the last published
release; the changes in this checkout have not been published. To install this
checkout locally, run `npm install -g .` from its root; no build is needed.

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

CommonJS callers on Node 24 can also use
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
