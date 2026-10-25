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

## Browser drawing and animation

Build and serve the [playground](../docs/playground.md):

```sh
bun run build:playground
bun run serve:playground
```

At `http://127.0.0.1:3000`, choose **A little landscape** for
[picture.bas](picture.bas), or **Bouncing ball** for [bounce.bas](bounce.bas).
The ball reverses before its outline would leave the logical 320 × 200 canvas.
Stop or Escape ends the animation; Run starts it fresh. You can edit or export
either program. Drawing requires a graphics host: these examples report
`GRAPHICS_UNAVAILABLE` in the terminal. [WAIT](../docs/wait.md) itself also works
in text-only Bun programs, with approximate timing and cancellable timers.

## File mode and the stored-program editor

`bun start` without a filename opens the stored-program editor. Enter numbered
source, or `LOAD "examples/guess.bas"`, then `RUN`. `LIST`, `SAVE`, `NEW`, and
`EXIT` manage source; see the [terminal guide](../docs/terminal.md). Each RUN
starts fresh variables without discarding the stored source. During BASIC
`INPUT`, the next line is the program's answer, even if it says `RUN` or `EXIT`.

Ctrl+C interrupts a running program, including busy loops, INPUT and WAIT.
File mode exits with status 130; the editor retains source and returns to its
prompt. For library execution use `runAsync` with an instruction budget when
termination is required. See the [host API](../docs/interpreter-host.md) and
[language contract](../docs/language-v0.1.md).
