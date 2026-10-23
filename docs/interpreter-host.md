# Interpreter and terminal lifecycle

The interpreter can now be imported and constructed without printing, opening
stdin/readline, or exiting Node. The package entry exports `Basic` and
`createHost`; the executable is a separate entrypoint. On Node.js 24.x the source
runs directly as ES modules, with no build step or runtime dependencies.

This API still executes the **legacy** statements documented in the README.
It is a foundation for the parser/runtime work, not the completed
[v0.1 language](language-v0.1.md). There are no stored-program editor commands,
variables, expression functions, or BASIC `INPUT` yet.

## Core API

```js
import {Basic} from 'node-basic-lang';
const output = [];
const basic = new Basic({write: (text) => output.push(text)});

basic.run('10 PRINT "first"\n20 END\n30 PRINT "not reached"');
basic.run('10 PRINT "second"');
// output is ['first\n', 'second\n']
```

CommonJS callers on Node 24 can use
`const {Basic} = require('node-basic-lang');`. Both forms resolve the same
`src/index.js` public entry. Internal source paths are not package exports.

- `new Basic(host = {})` constructs a quiet interpreter in `ready` state.
- `run(source)` resets state, executes nonblank source lines in their existing
  physical order, and returns `{status: 'halted'}` after `END` or end of source.
  Numeric sorting and complete-program validation arrive with the parser work.
- `readLine(line)` executes one legacy numbered statement and returns
  `{status: 'running'}` or `{status: 'halted'}`. It keeps validation history across
  calls. After completion or failure, further calls do not execute until reset.
- `reset()` clears validation/completion state and returns to `ready`.
- Invalid lines, commands, and numeric command arguments throw an `Error` and
  leave `status` equal to `error`. Host callback errors propagate the same way.
  A new `run()` or explicit `reset()` allows recovery. Lexical, duplicate-label,
  and legacy statement-syntax failures provide a structured `error.diagnostic`
  as described in [the tokenizer API](tokenizer.md). Runtime/host failures still
  use their existing errors.

Each interpreter has its own state. The core neither reads files nor owns
terminal resources. Only the host decides how to display errors or close itself.
File execution passes original physical line numbers and offsets to the
tokenizer, including blank lines and CRLF endings. Errors are still discovered
as each legacy line executes; the parser work will validate the whole program
before any output.

## Host callbacks

`createHost(overrides)` fills missing callbacks with quiet defaults and preserves
method receivers. It copies only the four callbacks below; constructing a host
never invokes them.

| Callback | Contract |
| --- | --- |
| `write(text)` | Synchronous text output. The core supplies exact newlines; the host must not add its own. The default discards output. |
| `clear()` | Synchronous clear-display request. The default does nothing. |
| `readLine(prompt, {signal})` | Promise resolving to one input string without its line ending, or `null` at EOF. Reject with an `AbortError` on cancellation. The default rejects as unsupported. |
| `random()` | Synchronous number `>= 0` and `< 1`; defaults to `Math.random`. Tests may inject a deterministic function. |

The input and randomness interfaces are available for the future `INPUT` and
`RND()` implementations. Existing legacy commands only consume `write` and
`clear`. Async host callback results are not supported for those two operations.

## Terminal adapter

`src/cli/run_cli.js` owns CLI argument routing and the filesystem adapter.
`runFile(path, host, {signal})` reads a file once and executes it in a fresh core
instance. Concurrent file loads therefore do not share line-number history.
`runCli(args)` owns a terminal host for one invocation and closes it in `finally`.
`src/cli/main.js` is the explicit executable entrypoint; it applies the returned
exit code through `process.exitCode` so output can drain naturally.

`TerminalHost` creates readline lazily, when the first input request starts.
It handles prompts, stdout/stderr, TTY clearing, EOF, and cancellation. Piped input
lines remain available in order, including lines received before another input
request and a final line without a newline. It permits one pending input request;
a second simultaneous request rejects without replacing the first.

Cancellation rejects the pending request and removes its abort listener. A fresh
request can then receive input; a cancelled request cannot resume later. `close()`
is idempotent, settles pending input, clears buffered lines, closes readline, and
removes listeners owned by the adapter. Further requests return EOF. Input-stream
errors reject pending reads and close the adapter. Injected streams remain owned
by the caller; the adapter does not destroy them.

The current interactive session still executes numbered entries immediately.
`END` or a command error resets that run and returns to the prompt, allowing line
numbers to be reused. A blank line or EOF closes the session. Ctrl+C while waiting
closes it with code `130`; the planned stored editor will later preserve source
and cancel only the run/current entry instead.

File mode opens no terminal input for the current commands. `END` skips remaining
lines without exiting the surrounding Node process. A file/command error is sent
to stderr and returns code `1`; extra CLI arguments retain the legacy code `9`.
Successful file or interactive completion returns `0`. The library never chooses
process exit codes. The CLI removes its SIGINT listener on every completion path.

The run loop is still synchronous. Yielding execution and interruption of busy
BASIC loops belong to #41; this refactor only handles cancellation of waiting
terminal input and file reads.

## Verification

`npm test` runs without `--forceExit`. Coverage includes quiet imports and
construction with stdin held open, normal and error completion, repeated and
independent runs, `END` followed by another interactive program, natural file
exit with stdin held open, EOF, SIGINT, input cancellation, piped lines, stream
errors, and removal of input/abort/signal listeners. `npm run lint` checks the
source, tests, executable, and development scripts. `npm run test:package`
installs a local tarball in a temporary consumer and verifies quiet ESM and
CommonJS imports, interpreter output, the installed CLI, and its metadata-derived
banner. No package is published by these checks.
