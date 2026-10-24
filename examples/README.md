# Runnable examples

Use **Bun 1.4.4** and run these commands from a fresh checkout:

```sh
git clone https://github.com/jesselpalmer/BASIC.git
cd BASIC
bun install --frozen-lockfile
bun run check
```

The commands below run the source in this checkout; no global installation or
published npm release is required. File mode validates the whole program before
execution, runs in numeric label order, and exits when the program finishes.

## Greeting

Run [greeting.bas](greeting.bas):

```sh
bun start examples/greeting.bas
```

At `What is your name? `, type `Ada` and press Enter. The terminal interaction is:

```text
What is your name? Ada
Hello, Ada!
```

Enter your name without quotes. String answers preserve their spaces and case.
Run the command again to greet another person.

## Guessing game

Run [guess.bas](guess.bas):

```sh
bun start examples/guess.bas
```

The program chooses a new random integer from 1 through 100. Enter a number and
press Enter, then use `Too low.` or `Too high.` to narrow your next guess. Keep
guessing until it reports success and the number of attempts.

For example, when the secret happens to be 42:

```text
Guess a number from 1 to 100? 20
Too low.
Guess a number from 1 to 100? 80
Too high.
Guess a number from 1 to 100? 42
Correct in 3 tries!
```

Your random secret and feedback can differ. Run the command again for a new game;
the attempt count starts at zero. The automated acceptance test fixes the random
value at `0.41` and checks the exact playthrough above, then a fresh one-guess win.

## File mode and the current REPL

`bun start` without a filename opens the current immediate-entry REPL. Numbered
statements execute as you enter them, in entry order; they are not stored for a
later `RUN`. Variables persist until `END` or an error resets the current run.
Stored-program commands such as `RUN`, `LOAD`, and `LIST` are not implemented yet
([#42](https://github.com/jesselpalmer/BASIC/issues/42)). A blank line or EOF closes
the REPL.

Use file mode for the guessing game: `IF` and `GOTO` require a complete program
and report `PROGRAM_REQUIRED` in the immediate-entry REPL. While `INPUT` is
waiting, the next line is the program's answer, even if it says `RUN` or `EXIT`.

Ctrl+C cancels pending terminal input and exits the CLI with status 130. Busy
programs do not yet yield to timers or reliably handle Ctrl+C; instruction limits
and busy-loop cancellation remain work for
[#41](https://github.com/jesselpalmer/BASIC/issues/41). When developing an unfinished
loop through the library, use a bounded number of `step()` calls. See the
[host API](../docs/interpreter-host.md) and
[language contract](../docs/language-v0.1.md) for current behavior and future targets.
