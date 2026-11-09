# EDUSYSTEM-30 selected profile

The bounded `edusystem-30` profile runs the reviewed March 1975
[23MTCH](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run)
and [LETTER](classic-source-review.md#letter) listings. Both automatically
start another round. The book and archived `EDU30.SV` runs supply the references.

- In the [playground](https://basic-playground-rho.vercel.app/), choose
  **23MTCH · EDUSYSTEM-30 selected profile** and select **Run program**.
  Enter 1, 2 or 3 on each turn. Select **Stop program** to end the session.
  For **LETTER · EDUSYSTEM-30 selected profile**, submit one uppercase letter
  at a time. Its higher and lower clues narrow the guess.
- For the CLI, export the selected source from the playground as a
  `.basic.json` document. Run `basic path/to/23mtch.basic.json` or use
  `LOAD "path/to/23mtch.basic.json"` and `RUN` in the editor. Press Ctrl+C
  to stop. A plain `.bas` file still selects native BASIC.
- For the library, call `parseProgram(source, {dialect: 'edusystem-30'})`
  and pass that Program to `new Basic(host, {dialect: 'edusystem-30'})`.
  Use `runAsync` for INPUT and cancel when done. The `readLine` callback receives
  `?` for numeric input and an empty prompt for character input. The
  `write` callback receives program output.
  Host input echo and the OS/8 banner are outside the library transcript.
  EOF while waiting for a move reports `INPUT_ENDED`.

## Admitted forms

| Area                   | Supported slice                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Statements             | Backslash-separated statements. REM, scalar LET, numeric IF with a literal line target, GO TO, scalar INPUT, FOR/NEXT with implicit step one, PRINT, RANDOMIZE and END. Complete nonempty source ends in END at the highest label.                                 |
| Values and expressions | Single-letter numeric scalars, small unsigned integer source literals, grouping, `+`, `-`, `*`, `/`, `INT(expression)` and `RND(0)`. Arithmetic uses the shared finite numeric evaluator for the game.                                                             |
| INPUT                  | Numeric input prompts with a bare `?` and retries invalid numbers. `INPUT $A` reads one ASCII character and writes its numeric code, with no extra prompt. The line-oriented host maps an empty response to Return (13) and retries longer or non-ASCII responses. |
| PRINT                  | Literal text, numeric scalar items and literal `CHR$(7)`. String-involved adjacency and semicolons join items. A trailing semicolon continues the line. Numeric fields have sign and trailing padding.                                                             |
| RNG                    | A fresh RUN starts from the [archived default seed](edusystem30-rng.md). RANDOMIZE adds a 12-bit host entropy word to the high seed word. Replay inside a RUN retains the stream.                                                                                  |

All lines are checked before execution, including unreachable lines. A supplied
Program must agree with its exact source. Source envelopes retain the explicit
dialect through import, save and reload. Immediate library statements are
native-only. Historical numeric precision, diagnostic continuation, general
`RND(X)`, and additional language forms require separate evidence.
A false line-target IF continues with the next backslash statement.

## Verification

A separate `EDU30.SV` terminal probe used `10 INPUT A`,
`20 PRINT "LEFT";A;"RIGHT"`, `30 GO TO 10`, and `40 END`. The entries
`0`, `-2` and `1.5` printed `LEFT 0 RIGHT`, `LEFT-2 RIGHT` and
`LEFT 1.5 RIGHT`. Entering `ABC` printed `BAD DATA-RETYPE FROM ERROR.`
and returned to the question mark.

The library, installed CLI and extracted browser build check the same
[archived transcript digest](edusystem30-reference.json). It covers the
printed loss, rejected zero, replay and win, and then a third-round probe.
Entering 2 in that third round leaves 19 matches. Entering 2 after a fresh
RUN leaves 20. The browser also verifies Step, Stop, and retention of a waiting
session when a replacement contains an unsupported statement.
