# Changelog

## 0.1.0 — release candidate

This candidate prepares the terminal MVP. No registry publication or release tag
is created by the preparation or validation steps.

- Add typed numeric/string variables, arithmetic and string expressions,
  `ABS(x)`, `INT(x)`, and host-provided `RND()`.
- Support `LET`, `PRINT`, `INPUT`, `IF`/`THEN`, `GOTO`, nested `FOR`/`NEXT`,
  `REM`, `CLS`, and `END`, with numeric line-label execution order.
- Add stored-program editing with replacement/deletion, `LIST`, `RUN`, `NEW`,
  `LOAD`, `SAVE`, and `EXIT`; preserve unsaved source after errors and interrupts,
  confirm destructive actions, and print recovery source at unsaved EOF.
- Validate complete programs before effects and report source-located errors.
  Yield asynchronous runs so pending input and busy loops can be interrupted.
- Provide a quiet embeddable API with synchronous/asynchronous execution,
  stepping, cancellation, isolated run state, and injected host capabilities.
- Ship TypeScript source, public types, the installed `basic` command, language
  and API documentation, and runnable greeting, times-table, and guessing-game
  examples. Test packed installations and ESM/CommonJS consumers on Bun.

### Migration from 0.0.10

- Bun >=1.4.4 is required; Node.js alone is not a supported runtime. ESM imports
  and CommonJS `require` are supported on Bun. There is no build step.
- Replace standalone `10 ABS "-3.14"` with `10 PRINT ABS(-3.14)` and standalone
  `20 INT "-1.6"` with `20 PRINT INT(-1.6)`. `INT` floors toward negative infinity.
- Files execute in numeric label order and reject invalid syntax, duplicate
  labels, missing targets, and unmatched loops before effects, even after `END`.
- `END` completes a run without terminating the embedding process. Terminal
  numbered entries edit source; use `RUN` to execute them. Legacy library
  `readLine` methods remain immediate-entry adapters.
- This is a limited BASIC dialect, not a QBasic or GW-BASIC compatibility release.
  Arrays, `DATA`/`READ`, `GOSUB`/`RETURN`, general immediate statements, graphics,
  sound, and a browser host are outside v0.1.0.

See the [language reference](docs/language-v0.1.md),
[terminal guide](docs/terminal.md), and [release checklist](docs/release-checklist.md).
