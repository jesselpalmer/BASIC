# Selected BASIC-PLUS FOR restarts

The selected `basic-plus-v4a12-ma2` profile keeps each executed FOR header's
captured limit and step until the run ends or that header executes again.
Headers that use the same numeric variable retain their own captured values.
A transfer out of a loop preserves that header state. Reentering a header
evaluates and assigns its new start value before evaluating its limit and step.

NEXT uses its lexically paired header and the scalar's current value. A
terminating NEXT leaves both the scalar and header state intact. A later
assignment can make that same NEXT continue the loop again. A skipped FOR
also retains its limit and step. When a paired header has never executed,
NEXT falls through without changing the scalar. Transfers may enter its
body before the header has executed.

The [earlier V4A-12 captures](rsts-v4a-ma2-for-restart-reference.json) cover
same-header and same-variable restarts, nested loops and unfinished exits.
The [additional archive probes](rsts-ma2-loop-reentry-reference.json)
match on rebuilt V4A-12 MA2 and archived V04B-17. They distinguish header state from a stack of active variables. They cover an
older I loop that resumes after another I loop completes, a completed loop
that resumes after assigning its scalar, descending and initially skipped
loops, preserved inner state, and entry before a header runs.

These rules let the [reviewed BAGLES source](bagles-rsts-review.md) restart
its digit-validation loops and replay after an early win. The profile's
exact signed-word loop-value bound and zero-step diagnostic still apply.
Whole-program validation pairs every FOR and NEXT before execution. A fresh
RUN clears all captured header state.

```sh
python3 scripts/research/capture-ma2-loop-reentry.py \
  --simulator /path/to/simh/BIN/pdp11 \
  --v4b-disk /path/to/RSTS11v4B.DSK \
  --v4a-disk /path/to/rebuilt/raw.dsk \
  --output /tmp/rsts-ma2-loop-reentry-reference.json
```

## PRINT FOR modifiers

The selected profile accepts a single `FOR` suffix on an ordinary `PRINT`,
including the `&` abbreviation. The modifier repeats only that PRINT; statements
after a colon execute once after the loop completes. Entry through the line label
initializes the header first. An empty range emits nothing. Descending ranges
use the same captured step and completion rules as an ordinary FOR/NEXT loop.
`GO TO` is accepted as the spaced spelling of GOTO in its existing statement and
conditional-transfer contexts.

The [PRINT FOR archive probes](rsts-ma2-print-for-reference.json) match rebuilt
V4A-12 MA2 and archived V04B-17. They cover ascending, descending and empty ranges,
colon successors, enclosing loops, label entry, compact `10&` spelling and the
spaced GO TO transfer. Ordinary and modifier self-referential bounds, plus a
self-referential STEP, establish that the new start is visible while the limit
and step are captured. These probes exposed and corrected the selected header
assignment order; native and EDUSYSTEM-30 retain their existing policies.

Preparation expands each supported modifier into three budgeted phases: the real
FOR header, the physical PRINT body and an implicit NEXT located at the header's
loop variable. Step and Stop work between all phases. A fresh RUN creates fresh
header state. Other modifier bodies, multiple modifiers, PRINT USING modifiers
and modifiers nested in inline conditional branches remain explicit unsupported
syntax. This does not enable the rest of the BASIC-PLUS modifier grammar.

```sh
PYTHONPATH=scripts/research python3 scripts/research/capture-ma2-print-for.py \
  --simulator /path/to/simh/BIN/pdp11 \
  --v4b-disk /path/to/RSTS11v4B.DSK \
  --v4a-disk /path/to/rebuilt/raw.dsk \
  --output /tmp/rsts-ma2-print-for-reference.json
```
