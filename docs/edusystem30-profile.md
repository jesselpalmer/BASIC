# EDUSYSTEM-30 selected profile

The bounded `edusystem-30` profile runs the
[reviewed March 1975 23MTCH source](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run).
The published game and archived `EDU30.SV` run supply the reference. The game
automatically starts another round after either result.

- In the [playground](https://basic-playground-rho.vercel.app/), choose
  **23MTCH · EDUSYSTEM-30 selected profile** and select **Run program**.
  Enter 1, 2 or 3 on each turn. Select **Stop program** to end the session.
- For the CLI, export the selected source from the playground as a
  `.basic.json` document. Run `basic path/to/23mtch.basic.json` or use
  `LOAD "path/to/23mtch.basic.json"` and `RUN` in the editor. Press Ctrl+C
  to stop. A plain `.bas` file still selects native BASIC.
- For the library, call `parseProgram(source, {dialect: 'edusystem-30'})`
  and pass that Program to `new Basic(host, {dialect: 'edusystem-30'})`.
  Use `runAsync` for INPUT and cancel when done. The `readLine` callback receives
  `?` and returns the user's response, while `write` receives program output.
  Host input echo and the OS/8 banner are outside the library transcript.
  EOF while waiting for a move reports `INPUT_ENDED`.

## Admitted forms

| Area                   | Supported slice                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Statements             | One statement per numbered line. REM, scalar LET, numeric IF with a literal line target, GO TO, scalar INPUT, PRINT and END. Complete nonempty source ends in END at the highest label.                |
| Values and expressions | Single-letter numeric scalars, small unsigned integer source literals, grouping, `+`, `-`, `*`, `/`, `INT(expression)` and `RND(0)`. Arithmetic uses the shared finite numeric evaluator for the game. |
| INPUT                  | One numeric scalar and a bare `?`. An invalid numeric entry prints `BAD DATA-RETYPE FROM ERROR.` and retries. The game's own checks reject numeric moves outside its rules.                            |
| PRINT                  | Literal text and numeric scalar items separated by semicolons. A terminal semicolon continues the line. Numeric output uses a space for a nonnegative sign and one trailing space.                     |
| RNG                    | The [archived default stream](edusystem30-rng.md) starts fresh on each RUN. A replay inside a RUN retains its state.                                                                                   |

All lines are checked before execution, including unreachable lines. A supplied
Program must agree with its exact source. Source envelopes retain the explicit
dialect through import, save and reload. Immediate library statements are
native-only. The verified behavior is the 23MTCH slice, with historical numeric
precision, diagnostics, general `RND(X)`, `RANDOMIZE`, and additional language
forms left for separate evidence and implementation.

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
