# Altair 8K BASIC LIFE2 profile

The bounded `altair-8k-4.0` profile runs the
[reviewed March 1975 LIFE2 listing](classic-source-review.md#life2) under the
rules verified on archived 1976 Altair BASIC 4.0. Two players enter column,row
coordinates from 1 to 5. The game starts another round after a win or draw.

- In the [playground](https://basic-playground-rho.vercel.app/), choose
  **LIFE2 · Altair 8K BASIC selected profile** and select **Run program**.
  Enter a coordinate pair such as `1,1`. Use **Stop program** to end the session.
- For the CLI, export the selected source as a portable `.basic.json` document.
  Run `basic path/to/life2.basic.json` or use `LOAD "path/to/life2.basic.json"`
  and `RUN` in the editor. Ctrl+C interrupts the current game.
- For the library, use `parseProgram(source, {dialect: 'altair-8k-4.0'})` and
  `new Basic(host, {dialect: 'altair-8k-4.0'})`. Use `runAsync` for INPUT.
  The host receives output through `write` and prompt text through `readLine`.
  EOF at a coordinate prompt reports `INPUT_ENDED`.

| Area              | Supported forms                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source            | Compact uppercase keywords, one-letter numeric names with an optional digit, colons, nested numeric IF, literal branches and subroutine calls, FOR/NEXT, REM and END. Programs retain the exact source and physical locations. |
| Values and arrays | Numeric assignments, comparisons, +, -, * and /, and numeric DATA/READ. Scalars default to zero. An initial DIM prologue supplies explicit, zero-based arrays. Positive fractional subscripts truncate.                        |
| INPUT             | Unprompted numeric scalars and indexed targets. Partial rows commit left to right, with the archived continuation, extra field and redo prompts.                                                                               |
| PRINT             | Semicolon-separated text and numeric values, an 80-column cursor, forward TAB, printable ASCII CHR$ and CHR$(13).                                                                                                              |
| RUN               | Bare numbered RUN starts at the first line with fresh scalars, arrays, DATA and control frames. It retains the terminal column, instruction budget, cancellation and debugger gate.                                            |

The profile uses shared finite JavaScript numbers and reports errors through
the library's structured diagnostics. Dynamic DIM, implicit arrays, other RUN
forms, and full Altair numeric and terminal emulation remain outside this
slice. The browser transcript includes typed responses.

The direct and installed library and CLI compare program output and prompt
text to the [archive capture](life2-altair-reference.json). The browser also
compares the transcript with input echo. Acceptance covers the printed win,
draw, both restarts and rejected coordinates. The CLI and browser exercise
Stop and a fresh run, and the browser verifies Step and failed replacement
while the prior game waits for input.
