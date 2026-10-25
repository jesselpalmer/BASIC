# Native computed dispatch

**Status:** implemented next native #57 slice; design recorded before code.
Historical profiles, GOTO expression OF lists and whole-game certification remain open.

## Evidence and native boundary

[BASIC-PLUS October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
§8.2 defines ON expression GOTO and §8.3 defines ON expression GOSUB. Both use
one-based list indexes after taking the integer part; §8.3 explicitly says to
truncate. Values outside the target list report an ON-statement range error,
rather than falling through. This is distinct from some later BASIC dialects.
The pinned BANNER lines 305, 320 and 330 use compact ON ... GOTO dispatch.
Their lexical spacing remains a separate historical dependency.

Native adds only the unambiguous statement forms `ON expression GOTO label,...`
and `ON expression GOSUB label,...`. ON and GOSUB remain contextual identifiers;
existing ON/GOSUB scalar and array assignments/references keep their old ASTs.
No new reserved words, source rewriting, GO SUB alias, computed literal GOTO,
error trapping, compact lexing or automatic historical profile selection is introduced.
ERROR remains an ordinary native selector name: `ON ERROR GOTO 20` dispatches
using that variable and never installs an error handler. Grouped selectors such
as `ON (X+1) GOTO ...` remain distinct from existing ON-array assignments; the
matching close followed by `=` identifies an assignment.
BATTLE 140 and BUG 340/990 use GOTO expression OF lists, a distinct form outside
this native slice. Do not reinterpret those sources as ON grammar or claim them
compatible through a normalized probe.

## Immutable syntax and complete validation

Add an explicit OnStatement with selector Expression, transfer `goto` or
`gosub`, and a readonly list of NumberLiteral targets. Every target uses native
unsigned decimal labels 1..65535 and must exist before effects, including
unselected targets, code after END and dead conditional branches. Empty,
expression-valued, signed, fractional, scientific and malformed target lists are
errors. Duplicate labels are valid. Preserve each literal's raw spelling/span.

Limit each list to 4096 targets. The bound caps list allocation, copying and
whole-program target checks independently of the number of executable instructions;
a dispatch still costs one instruction. Enforce the inclusive bound in source
and caller-constructed ASTs. Constructed trees also validate transfer mode, list
shape, target kind/raw/value and numeric selector type before snapshots are
installed. Existing static array/keyboard/expression validation traverses selectors.
parseLine permits missing forward labels for editing; complete preparation rejects
them. Copy/freeze the new list with the same independent snapshot machinery.

## Execution and ownership

Evaluate the selector once, left to right through the shared evaluator. It must
produce a finite number; mixed/string results report TYPE_MISMATCH. Truncate
toward zero with Math.trunc, then require 1 through the list length. An invalid
index reports DISPATCH_RANGE at the original selector, before any transfer or
call-frame change. Huge finite values fail the same range check without coercion
to a JavaScript signed integer. Do not evaluate unselected targets or synthesize
GOTO/GOSUB instructions.

GOTO dispatch uses the selected literal's source location and the existing
native jump/loop guards. GOSUB dispatch uses the same call owner as literal
GOSUB, saving the prepared successor and suspending caller loop ownership.
RETURN therefore reaches the same-line tail or next numbered line required by
physical-last-clause scope. Selected call targets retain native lexical loop-entry
checks and the 1024-call bound; terminal paths clear frames normally. The selector
and transfer together cost one Step/gate/budget unit. Native INPUT/WAIT,
cancellation, replacement, immediate PROGRAM_REQUIRED and rerun behavior stay
with the shared driver.

## Verification and remaining scope

Use independent traces for every list index, truncation edges, zero/negative/
huge indices, string/mixed selectors, exact selected-literal/selector error spans,
all-target preflight, malformed constructed lists and inclusive list bounds.
Cover selectors with host evaluation counts, ordinary ON/GOSUB scalar/array
names, nested and same-line calls, inline conditionals, caller/callee loops,
stack bounds, gates/budgets, async effects, cancellation and fresh instances.
Verify immutable source/constructed ASTs and unchanged existing native trees.

The authored [BANNER-derived selector probe](../scripts/package/fixtures/dispatch/probe.bas)
names all inserted whitespace and new scaffolding. The source at pinned corpus
commit `45f75052be3f436f2e575f58d4aa611484268227` has blob
`0497d5eec6ddb942415ad9439010ee47c66d4be8`; all ten line-305 targets are retained. It is neither unchanged-source nor whole-game certification.
Verify direct/installed ESM/CommonJS/types/CLI/editor and actual Chromium/extracted
archives with Linux/macOS checks. #57 remains open for verified historical
profiles, GOTO expression OF lists and game outcomes; #109 remains NOT READY.
