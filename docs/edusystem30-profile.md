# EDUSYSTEM-30 selected profile

The bounded `edusystem-30` profile runs the reviewed March 1975
[23MTCH](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run),
[LETTER](classic-source-review.md#letter), [TRAP](classic-source-review.md#trap),
[LITQZ](classic-source-review.md#litqz), [MATHD](classic-source-review.md#mathd),
[NUMBER](number-edusystem30.md), [STARS](stars-edusystem30.md),
[HURKLE](hurkle-edusystem30.md), [CHANGE](change-edusystem30-review.md),
[CHEMST](chemst-edusystem30.md), [DIAMND](diamnd-edusystem30-review.md),
[BATNUM](batnum-edusystem30.md), [EVEN](even-edusystem30.md),
[ROCKET](rocket-edusystem30.md), [BOUNCE](bounce-edusystem30.md),
[CHOMP](chomp-edusystem30.md), [MUGWUMP](mugwump-edusystem30.md), and
[3DPLOT](3dplot-edusystem30.md) listings.
It also runs the separately labeled adaptations
[KINEMA](kinema-edusystem30.md), [GOMOKO](gomoko-edusystem30-review.md) and
[AMAZIN](amazin-edusystem30.md), [BUZZWD](buzzwd-edusystem30.md), and
[GUESS](guess-edusystem30-review.md), [CALNDR](calndr-edusystem30-review.md),
and [ROCKSP](rocksp-edusystem30-review.md).
Select `edusystem-30-mark` for the reviewed [GOLF](golf-edusystem30.md) and
[BLKJAK](blkjak-edusystem30-review.md) and [SLOTS](slots-edusystem30.md)
listings, plus the [TOWER](tower-edusystem30-review.md),
[REVERSE](reverse-edusystem30-review.md), [EVEN1](even1-edusystem30-review.md),
[CHIEF](chief-edusystem30-review.md), [HI-LO](hi-lo-edusystem30-review.md),
and [ROCKT1](rockt1-edusystem30-review.md) adaptations, plus the three
programs in [OMSI Baseball](basbal-edusystem30-review.md). Both modes share the same
grammar and runtime. They encode character input using SPACE and MARK
parity respectively, and preserve that choice in portable documents.
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
  For **HURKLE · EDUSYSTEM-30 selected profile**, enter a pair such as `5,5`
  and use the compass hints to find the Hurkle in five guesses.
  For **CHANGE · EDUSYSTEM-30 selected profile**, enter a cost such as `4.59`
  and a payment such as `10` to see the receipt and denominations.
  For **CHEMST · EDUSYSTEM-30 selected profile**, enter `26` for the first
  dilution and try to stay within five percent of the amount required each round.
  For **DIAMND · EDUSYSTEM-30 selected profile**, enter an odd size from 5 to 31.
  For **BATNUM · EDUSYSTEM-30 selected profile**, enter a pile size and choose
  whether taking the last object wins. Then enter the move bounds as a pair.
  For **EVEN · EDUSYSTEM-30 selected profile**, choose who starts and take
  one to four marbles per turn. Aim for an even total.
  For **ROCKET · EDUSYSTEM-30 selected profile**, enter a burn rate from 0 to
  200 at each prompt and try to land softly.
  For **BOUNCE · EDUSYSTEM-30 selected profile**, enter the time increment,
  velocity and coefficient of elasticity. The printed plot uses `.1`, `30`
  and `.9`.
  For **KINEMA · EDUSYSTEM-30 adaptation**, answer three questions about the
  ball's flight. A new problem follows each score.
  For **CHOMP**, choose player count and board dimensions, then enter row and
  column pairs. For **MUGWUMP**, enter coordinate pairs and find four hidden
  creatures within ten guesses.
  The **GOMOKO** adaptation declares the board at the size described in the
  book. The **AMAZIN** adaptation uses smaller DIM bounds to fit the archived
  system. Try `9,7` for its sample dimensions.
  For **BUZZWD**, enter three digits separated by commas. Enter
  `100,100,100` to finish. For **3DPLOT**, select Run to draw the 41-row plot.
  **GOLF**, **BLKJAK**, **TOWER**, **SLOTS**, **REVERSE**, and **EVEN1**
  select MARK input automatically. Enter a single letter at a character
  prompt and submit numbers at the other prompts. For **GUESS**, enter a
  positive integer limit and follow the high and low clues. Enter `0` to
  change the limit. Choose **OMSI Baseball · EDUSYSTEM-30 MARK adaptation**,
  enter `BASEBALL` at the menu and submit a team name.
- For the CLI, export the selected source from the playground as a
  `.basic.json` document. Run `basic path/to/23mtch.basic.json` or use
  `LOAD "path/to/23mtch.basic.json"` and `RUN` in the editor. Press Ctrl+C
  to stop. A plain `.bas` file still selects native BASIC.
- For the library, call `parseProgram(source, {dialect: 'edusystem-30'})`
  and pass that Program to `new Basic(host, {dialect: 'edusystem-30'})`.
  For MARK input, use `edusystem-30-mark` in both calls.
  Use `runAsync` for INPUT and cancel when done. The `readLine` callback receives
  `?` for numeric input and an empty prompt for character input. The
  `write` callback receives program output.
  Host input echo and the OS/8 banner are outside the library transcript.
  EOF while waiting for a move reports `INPUT_ENDED`.

## CHAIN and program libraries

`CHAIN "NAME"` transfers execution to a complete program supplied by the host.
The selected grammar admits one to six uppercase letters or digits followed by
optional spaces inside the quotes. The synchronous `Host.loadProgram(name)`
callback receives the name padded on the right to six characters and returns
source or `null`. The target uses the same selected dialect and gets fresh
variables, arrays, subroutine and loop state, random seed, input buffers, and
print column. Its own DATA replaces the current DATA pool. A target without
DATA inherits the effective pool and starts reading from the beginning. The
transfer emits no newline. A fresh RUN starts at the original source.

Use `basic --chain-dir DIR` to give the CLI/editor an explicit library of
uppercase `NAME.bas` files. Embedders can supply the same resolver through
`BrowserSession` options. The playground provides the three baseball programs.
The archived scratch-file `WRITE` mechanism is outside this profile.
[Archive probes](edusystem30-omsi-reference.json)

## Admitted forms

| Area                   | Supported slice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statements             | Backslash-separated statements. REM, LET (including compact spelling before a scalar assignment), numeric DIM, numeric DATA/READ and bare RESTORE, numeric IF with a literal line target, GO TO, literal GOSUB and RETURN (including compact literal transfer targets), INPUT, FOR/NEXT with optional signed STEP, PRINT, RANDOMIZE or RANDOM, literal CHAIN, STOP and END. Complete nonempty source has an END statement at the highest label. Unary numeric `DEF FN` definitions bind before execution. |
| Values and expressions | Numeric scalars use a letter and optional digit and default to zero. Source admits decimal and scientific literals within the compiled range, grouping, unary `+` and `-`, binary `+`, `-`, `*`, `/`, `^` with stored integer exponents 0 through 20, and single-argument ABS, EXP, INT, LOG, RND and SQR. Scalar arithmetic stores the archived binary exponent and 23-bit magnitude.                                                                                                                    |
| Arrays                 | Rank-one numeric arrays without DIM have indices 0 through 10. Explicit DIM sets inclusive zero-based bounds for rank one or two. Nonnegative fractional indices truncate. Same-name scalar and array storage are independent. Fresh RUN clears array elements. See the [archive probes](edusystem30-arrays.md).                                                                                                                                                                                          |
| INPUT                  | Unprompted numeric INPUT accepts one to three scalar targets. The terminal reads comma-separated values and prompts with `?` when it needs more. `INPUT $A` reads one ASCII character and stores its ASCII value in SPACE mode or sets bit 7 in MARK mode, with no extra prompt. An empty character response represents Return. Indexed character INPUT reads successive bytes from a printable ASCII line.                                                                                               |
| PRINT                  | Literal text, bounded numeric expressions, numeric `CHR$(expression)` (printable ASCII and BEL) and top-level `TAB(expression)`. String-involved adjacency and semicolons join items. A trailing semicolon or comma continues the line. Commas advance through the archived 14-column zones. Numeric fields use archived sign and trailing padding, fixed/scientific selection and digit rules.                                                                                                           |
| RNG                    | A fresh RUN starts from the [archived default seed](edusystem30-rng.md). RND evaluates its numeric argument and then draws regardless of the argument value. RANDOMIZE adds a 12-bit host entropy word to the high seed word. Replay inside a RUN retains the stream.                                                                                                                                                                                                                                     |

Character constants compile to marked ASCII in both modes. The selected
spellings are `#` followed by an uppercase letter, decimal digit, `#`, or `!`.
For example, `#N` stores 206. Typing N stores 78 in SPACE mode and 206 in MARK
mode. Numeric `CHR$` rounds down, masks to seven bits and emits the resulting
printable character or BEL. Other terminal control bytes report a located
diagnostic.

Unary `DEF FN` functions use a single letter for the function name and a
letter and optional digit for the formal. The last numbered definition wins. The argument
is evaluated before the formal shadows the current scalar for the call. Evaluated
recursive calls and expressions exceeding 4,096 function calls report located
diagnostics. [DEF evidence](3dplot-edusystem30.md)

`EXP` uses archived stored arithmetic and accepts zero or stored magnitudes
from `2^-1000` through 700. [EXP evidence](edusystem30-exp-evidence.md)
`LOG` evaluates the natural logarithm of the stored magnitude. Zero and a reciprocal outside
the stored exponent range report located domain errors. [LOG evidence](edusystem30-log-evidence.md)

All lines are checked before execution, including unreachable lines and
function definitions overridden by a later definition. A supplied
Program must agree with its exact source. Source envelopes retain the explicit
dialect through import, save and reload. Immediate library statements are
native-only. The shared source tokenizer requires finite JavaScript numbers.
The stored converter uses the literal spelling, including when it underflows
at that host boundary. Numeric precision outside the captured cases,
diagnostic continuation, and additional language forms require separate evidence.
A false line-target IF continues with the next backslash statement.
STOP finishes the run like END and skips later statements on the same line.
A subsequent RUN starts over. The program must still end in END.

An indexed character read such as `INPUT $A(I)` or `INPUT $A(I,J)` requests
a printable ASCII line and stores one byte. Subsequent character reads
consume the rest of the line, then Return. An empty reply gives Return
immediately. A scalar character read without a buffered line still requests
one ASCII character and retries a longer reply. Numeric INPUT uses remaining
numeric fields first, then can consume a buffered character line's remainder.
See the [archived baseball input probes](basbal-edusystem30-review.md).

Numeric INPUT skips blank fields and spaces, retains surplus fields for later
numeric INPUT in the same run, and retries a bad field after dropping the
remainder of that response. Values already read for that statement are kept
through the retry. The host commits targets when the statement has all its
values, so cancellation during a partial read leaves the targets unchanged.
Fresh RUN clears the field buffer. The [source compiler conversion](edusystem30-source-literals.md)
uses its own decimal scale table. INPUT converts decimal digits in its
archived order and retains the stored numeric value. Public variable
snapshots and the shared FOR cursor observe finite JavaScript numbers.
FOR counts iterations independently of the visible scalar and evaluates STEP
at loop entry. The default step is one. A step that observes as zero at the
JavaScript boundary produces `ZERO_STEP`, including a stored value that
underflows there.
An archive probe from 8388608 to 8388610 runs the body three
times while the scalar's increment rounds away. A probe that increments the
visible scalar inside `FOR I=1 TO 3` prints `1`, `3`, and `5` in the body,
then `6` after the terminating NEXT.
The [STEP capture](edusystem30-step-reference.json) checks descending loops,
fractional steps, reversed bounds and a STEP expression changed in the body.

`TAB` uses the archived column position across trailing semicolons. It wraps
its target modulo 70 before rounding up. A lower target sends carriage return
and NUL followed by the required padding. [TAB evidence](edusystem30-tab-evidence.md)

A PRINT comma advances to column 14, 28, 42 or 56, then wraps with a blank
and a line break after the last zone. A trailing comma positions the next
output or INPUT prompt. [Comma evidence](edusystem30-print-comma-evidence.md)

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
a loss, a replay win and a fresh run. The [HURKLE capture](hurkle-edusystem30-reference.json)
checks the printed opening win, compass clues, a loss and automatic replay.
The [CHANGE review](change-edusystem30-review.md) records the arithmetic,
decimal INPUT and numeric PRINT evidence. Its full receipt transcript verifies
all ten archived sales and a fresh run.
The [CHEMST capture](chemst-edusystem30-reference.json) checks invalid-input
retry, successful and failed dilutions, the ninth miss and a fresh run.
The [DIAMND capture](diamnd-edusystem30-reference.json) checks all pattern
rows at sizes 5, 15 and 31 against the debugger-repaired archive. The
[BATNUM capture](batnum-edusystem30-reference.json) checks the three printed
games, fresh RUN, invalid settings and a forfeit.

The [EVEN capture](even-edusystem30-reference.json) checks the printed game,
a winning replay and a fresh computer-first run with illegal-move retries.
The [ROCKET capture](rocket-edusystem30-reference.json) checks every printed
flight row, the landing, a zero-burn crash and automatic restarts. The
[roots and powers probes](edusystem30-roots-evidence.md) verify stored
results independently of the game.

The [BOUNCE capture](bounce-edusystem30-reference.json) verifies the printed
plot, a replay with new parameters and fresh RUN. The [KINEMA
capture](kinema-edusystem30-reference.json) verifies all answer bands, the
score reset and fresh RUN for the spelling adaptation. The source review
records the original archive rejection.

The [GOLF capture](golf-edusystem30-reference.json) covers multiplayer score
totals, traps, water and a sunk shot. The [BLKJAK
capture](blkjak-edusystem30-reference.json) covers wager validation, a player
bust and both bankroll summaries. Their deterministic acceptance uses the
same clock words as the archive.
