# BASIC 1.0.0

BASIC 1.0 brings a small, documented line-numbered dialect to a Bun library/CLI
and a static browser playground. It includes a complete playable Pong game whose
logic is written in BASIC. The exact candidate, validation evidence and
publication status are recorded in [release readiness #109](https://github.com/jesselpalmer/BASIC/issues/109).

## Included

- Typed numeric/string variables, expressions, ABS/INT/RND, PRINT/INPUT,
  IF/THEN and GOTO, nested FOR/NEXT loops, REM, CLS and END.
- Stored-program terminal editing with LIST/RUN/NEW/LOAD/SAVE/EXIT, protected
  replacements and persistence, source-located diagnostics, cancellation and
  recoverable errors.
- A quiet TypeScript package with immutable prepared programs, synchronous and
  asynchronous execution, stepping, instruction budgets and injected hosts.
- A static browser editor with local draft recovery, exact `.bas` import/export,
  Run/Stop/Escape, Pause/Continue/Step, source highlighting and read-only variables.
- A fixed 320 × 200 canvas and 16-color COLOR/PSET/LINE/CIRCLE drawing;
  cancellable WAIT; focused INKEY$/KEYDOWN input with bounded queues and cleanup.
- Greeting, times-table, guessing-game, picture, bouncing-ball, arrow-key marker
  and Pong examples. Pong includes Space serves, a computer opponent,
  first-to-three scoring, win/loss and restart.

## Requirements and compatibility

The package and terminal require **Bun >=1.4.4** and ship TypeScript directly.
Linux/macOS are tested using Bun 1.4.4; Node.js alone is unsupported; Windows execution is not a validated 1.0 target. ESM and CommonJS consumers are supported on Bun.
The static playground is validated in desktop Chromium on Linux/macOS; other
browser engines and mobile input are not validated targets. Serve the extracted
playground over HTTP; no application backend or account is required.

This is not a QBasic or GW-BASIC compatibility release. Arrays, GOSUB/RETURN,
additional string functions, sound and play-only exports are outside the 1.0
scope. The [language reference](language-v1.md) and
[support/extension policy](compatibility.md) define the supported contract.

Migration from the earlier JavaScript package requires Bun and named imports,
expression forms for ABS/INT, numeric-label execution, and stored terminal edits
followed by RUN. END returns to the host. Complete-program validation can reject
source that previously executed partially. See the
[migration guide](compatibility.md#migration-from-the-older-javascript-package).

## Try it

Install the reviewed `node-basic-lang-1.0.0.tgz` archive with Bun, or serve the
reviewed `BASIC-playground-1.0.0.tar.gz` static archive after extraction. The
release manifest identifies their exact hashes and candidate commit. Until
publication completes, use the candidate artifacts identified in #109 rather
than assuming an unversioned registry install resolves to this version.

For Pong, choose **Pong**, Run, Enter at the start prompt, focus the canvas, and
press Space to serve. Hold Up/Down; first to three wins. Enter at the result
prompt starts a fresh match. Escape or Stop ends the run.

Publication attaches the reviewed archives and manifest to the matching release,
publishes the reviewed npm package, then verifies a clean published installation
and release downloads. Preparing these notes does not perform those actions.
