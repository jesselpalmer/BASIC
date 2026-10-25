# Statements and instruction positions

**Status:** implemented first native #118 slice; design recorded before code. The full
historical conditional/profile and subroutine work stays open.

## Native grammar and source

Add colon-separated native statements on one numbered physical line. Preserve
all original text, labels and physical UTF-16 locations. A line with one statement
keeps its existing AST exactly. A line with multiple statements has a distinct
StatementSequence node containing at least two ordinary statements plus the
actual colon separator locations. No empty, leading, repeated or trailing colon
is accepted. REM consumes the remainder of its physical line; colons in REM,
strings or PRINT USING template strings never become separators. PRINT USING
lookahead stops at a statement boundary so a later comma cannot reinterpret an
earlier USING variable. Backslash separators and inline THEN/ELSE/modifiers
remain separate, unsupported historical grammar.

A sequence is structural, not an executed instruction. It cannot contain another
sequence. Cap each physical line at 4096 executed statement nodes; enforce this
in parsing, complete validation and immediate-entry preflight before effects.
Reject malformed caller-supplied sequence lists and inconsistent separator counts.

## Prepared and execution ownership

One validated immutable Program retains numbered Lines and their source trees.
Preparation derives a flat instruction table in numeric-label order. Each entry
carries its original Line, statement ordinal and real leaf statement. The label
index maps to the first instruction on a numbered line; no synthetic BASIC labels
or rewritten source are introduced. Loop pairing uses instruction positions,
including FOR and NEXT on the same line. Whole-program declaration/reference,
keyboard/graphics/output and jump validation visits every leaf, even after END
or an unconditional jump, before host effects or array allocation.

Runtime control flow advances by one instruction. Step, async statement gates,
budgets and cooperative yields all count leaf statements; the structural sequence
costs nothing. Current/next locations use leaf spans, so several instructions can
share a label and physical line while retaining different columns. GOTO enters
a numbered line at its first instruction. END prevents following instructions
on that line from executing. Existing loop entry/discard rules are preserved
using flat instruction positions. An empty loop skips its matching NEXT but
continues with the following same-line statement. Future GOSUB return addresses
must use these positions rather than labels; calls are not added in this slice.

Legacy immediate readLine/readLineAsync remain single-statement entrypoints.
Reject a sequence as PROGRAM_REQUIRED before any member executes; users can
run/step a complete program instead. Stored terminal editing still accepts a
whole numbered source line and LIST/save preserves it exactly.

## Conditional boundary

BASIC-PLUS October 1972 section 3.5 explicitly sends a false condition to the
next numbered line; its multiple-statement rules attach following statements to
the physically last THEN clause. For the existing IF condition THEN literal-label
form, true jumps to that label and false skips the remaining physical line. This
also preserves all existing single-statement native behavior. Apply the existing
native loop-entry/discard guards to the false-path destination; do not invent an
active loop if a skipped same-line FOR header would otherwise enter its body.
Inline THEN statements, ELSE, nested conditions and postfix modifiers remain
#118 work and must preserve their own clause structure when added.

## Verification

Use independent observable traces for same-line forward/backward GOTO, nested
FOR/NEXT, empty loops, END, preflight validation after earlier output/END,
statement-column diagnostics, PRINT USING contextual names, copied snapshots,
INPUT/WAIT followed by more work, instruction limits, cancellation/replacement,
reruns and long bounded sequences. Compare old single-statement ASTs and keep
native program/game regressions. Exercise direct and installed ESM/CommonJS,
consumer types, file and stored-editor CLI, browser Pause/Step/highlighting,
source import/export/reload and exact extracted static distribution.

Colon separation is documented in [BASIC-PLUS October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf) section 2.3.1; immediate-mode restrictions in section 4.3; IF/ELSE
scope in section 8.5 differs across historical versions and stays explicit.
The pinned AWARI listing uses colon-separated assignment pairs (e.g. line 600).
The acceptance probe adds explicit LET whitespace; compact keyword lexing remains
unsupported and the probe is not an unchanged-source compatibility result.
An isolated source expression/sequence probe is not whole-game certification;
AWARI's missing data and other historical requirements remain unresolved.
