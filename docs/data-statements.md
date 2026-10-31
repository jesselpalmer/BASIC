# Native DATA, READ, and RESTORE

**Status:** implemented first native #122 slice; design recorded before code.
Historical profiles and whole-game certification remain pending.

The internal historical scanner has a separate [DATA source mode](historical-data-scanner.md)
that retains pool fields as text. It does not enable historical parsing, READ
conversion, pool preparation or a public profile; the native contract below stays typed.

## Evidence and boundary

[BASIC-PLUS October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
§3.3.1 defines a program-wide pool in numbered-line order, sequential READ,
bare RESTORE to the beginning, exhaustion, and DATA as the last statement of a
physical line. §5.3 describes quoted strings and the historical ASCII pool's
target-dependent conversion and unquoted whitespace rules. The pinned corpus
contains numeric tables in QUBIC and quoted strings in ANIMAL line 1100.

This native extension deliberately keeps native typed assignment: numeric data
requires a numeric target and quoted string data requires a `$` target. It does
not claim BASIC-PLUS ASCII conversion, unquoted strings, integer suffixes,
postfix READ loops, targeted RESTORE, continuation lines, or historical profiles.
Those stay explicit #115/#116/#122 work. Missing AWARI data stays a source defect;
exhaustion never manufactures a value.

## Grammar and preparation

Use contextual DATA, READ and RESTORE after ordinary assignment detection, so
their existing scalar/array names remain available. DATA takes a nonempty comma
list of finite native decimal/scientific literals with at most one leading sign,
or quoted strings with native doubled-quote escaping. Whitespace outside literals
is insignificant; quoted whitespace, punctuation and empty strings are retained.
No expressions, unquoted text, omitted fields, trailing comma or comments are
accepted. DATA must be the final statement on its physical line; a colon inside
a quoted string remains text. READ takes a nonempty comma list of scalar/array
assignment targets. RESTORE has no argument and may occur within a sequence.

Cap DATA items and READ targets at 4096 per statement, and the prepared pool at
262144 items. Enforce limits and literal/target shapes on caller-supplied trees
as well as source, including unreachable statements, before host effects. Whole
program validation resolves array declarations/ranks/index types even after END.
Preserve raw literals and physical locations; existing single-statement ASTs do
not change. Collect immutable literal nodes from the validated sorted snapshot,
including DATA after END or behind skipped branches. Executing DATA is a no-op
that costs one statement; collecting DATA is not control-flow dependent.

## Execution ownership

Each fresh execution owns a cursor initially zero, separate from immutable
prepared data. READ assigns targets left to right through the existing evaluator.
Earlier successful assignments are visible to later array-index expressions.
Advance the cursor only after a successful assignment. If an item is missing,
report OUT_OF_DATA at the unsatisfied target without evaluating its index. Type,
index and exhaustion errors preserve earlier successful assignments and stop the
run. There is no coercion, rollback, retry or default value. RESTORE resets only
the cursor, retaining variables, arrays and loop/call frames.

GOTO, IF, loops, GOSUB and RETURN neither save nor restore the shared cursor.
Stepping/statement gates/budgets count a READ list as one statement. INPUT/WAIT
suspension preserves the cursor; cancel/error/END cannot resume it. Reset,
replacement and rerun create a fresh reader; independent runtimes never share
cursor state. Legacy immediate entry rejects all three forms as PROGRAM_REQUIRED.

## Verification

Test numeric/quoted data, exact raw spans, pool order independent of source order
and reachability, scalars/arrays, sequential indices, RESTORE, shared subroutine
reads, loops, exhaustion/type/bounds failures, invalid constructed ASTs, limits,
immutable snapshots, gates/budgets/cancellation/replacement and clean reruns.
Use unchanged QUBIC/ANIMAL DATA lines in an explicitly authored feature probe;
retain source defects and do not call this a whole-game pass. Exercise the same
probe through direct/installed ESM/CommonJS, public types, file/editor CLI and
Chromium import/export/reload/Step/recovery, then exact extracted distributions.
