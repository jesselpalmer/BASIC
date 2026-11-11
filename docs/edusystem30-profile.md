# EDUSYSTEM-30 selected profile

The bounded `edusystem-30` profile runs the reviewed March 1975
[23MTCH](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run),
[LETTER](classic-source-review.md#letter), [TRAP](classic-source-review.md#trap),
[LITQZ](classic-source-review.md#litqz), [MATHD](classic-source-review.md#mathd),
[NUMBER](number-edusystem30.md), and [STARS](stars-edusystem30.md) listings.
The book and archived `EDU30.SV`
runs supply the references.

- In the [playground](https://basic-playground-rho.vercel.app/), choose
  **23MTCH · EDUSYSTEM-30 selected profile** and select **Run program**.
  Enter 1, 2 or 3 on each turn. Select **Stop program** to end the session.
  For **LETTER · EDUSYSTEM-30 selected profile**, submit one uppercase letter
  at a time. Its higher and lower clues narrow the guess.
  For **TRAP · EDUSYSTEM-30 selected profile**, submit two bounds separated by
  a comma. Enter the same number twice to make an exact guess.
  For **LITQZ · EDUSYSTEM-30 selected profile**, enter an answer from 1 to 4
  for each question. Select Run again to start a fresh quiz.
  For **MATHD · EDUSYSTEM-30 selected profile**, enter the sum of the two dice.
  For **NUMBER · EDUSYSTEM-30 selected profile**, guess a number from 1 to 5
  until the score reaches 500.
  For **STARS · EDUSYSTEM-30 selected profile**, guess a number from 1 to 100.
  More stars mean your guess is closer.
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

| Area                   | Supported slice                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statements             | Backslash-separated statements. REM, scalar LET, numeric IF with a literal line target, GO TO, literal GOSUB and RETURN, INPUT, FOR/NEXT with implicit step one, PRINT, RANDOMIZE, STOP and END. Complete nonempty source ends in END at the highest label.                                                                                              |
| Values and expressions | Numeric scalars use a letter and optional digit and default to zero. Source admits small unsigned integers and `.5`, grouping, `+`, `-`, `*`, `/`, `ABS(expression)`, `INT(expression)` and `RND(expression)`. Arithmetic uses the shared finite numeric evaluator.                                                                                      |
| INPUT                  | Unprompted numeric INPUT accepts one or two scalar targets. The terminal reads comma-separated values and prompts with `?` when it needs more. `INPUT $A` reads one ASCII character and writes its numeric code, with no extra prompt. The line-oriented host maps an empty character response to Return (13) and retries longer or non-ASCII responses. |
| PRINT                  | Literal text, numeric scalar items and literal `CHR$(7)`. String-involved adjacency and semicolons join items. A trailing semicolon continues the line. Numeric fields have sign and trailing padding.                                                                                                                                                   |
| RNG                    | A fresh RUN starts from the [archived default seed](edusystem30-rng.md). RND evaluates its numeric argument and then draws regardless of the argument value. RANDOMIZE adds a 12-bit host entropy word to the high seed word. Replay inside a RUN retains the stream.                                                                                    |

All lines are checked before execution, including unreachable lines. A supplied
Program must agree with its exact source. Source envelopes retain the explicit
dialect through import, save and reload. Immediate library statements are
native-only. Historical numeric precision, diagnostic continuation, and
additional language forms require separate evidence.
A false line-target IF continues with the next backslash statement.
STOP finishes the run like END and skips later statements on the same line.
A subsequent RUN starts over. The program must still end in END.

Numeric INPUT skips blank fields and spaces, retains surplus fields for later
numeric INPUT in the same run, and retries a bad field after dropping the
remainder of that response. Values already read for that statement are kept
through the retry. The host commits targets when the statement has all its
values, so cancellation during a partial read leaves the targets unchanged.
Fresh RUN clears the field buffer. This profile uses finite decimal input.

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

The [TRAP capture](trap-edusystem30-reference.json) verifies paired input,
retry, reversed bounds, a win, a six-guess loss, and replay. Its separate
terminal probe verifies retained fields across numeric INPUT statements,
missing fields and retyping only the failed value. Installed CLI/editor and
Chromium also interrupt a partially entered guess and start a fresh run.

The [LITQZ capture](litqz-edusystem30-reference.json) verifies the printed
sample's three-correct finish, the four-correct finish and the zero-correct
finish. An isolated archive probe compares STOP and END inside a backslash
sequence. Both return to the interpreter without executing the following
statements, and the archive rejects CONT.

The [MATHD capture](mathd-edusystem30-reference.json) checks all six faces,
both retry outcomes and the next round. The [NUMBER capture](number-edusystem30-reference.json)
checks the printed scores, halving and jackpots through both wins. The
[STARS capture](stars-edusystem30-reference.json) checks all seven clue lengths,
a loss, a replay win and a fresh run. The [CHANGE review](change-edusystem30-review.md)
records word-level arithmetic evidence and the remaining decimal INPUT and
numeric PRINT requirements.
