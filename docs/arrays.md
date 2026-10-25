# Explicit native arrays

This is the implemented contract for the first slice of #58, settled before
code. It extends the native dialect without selecting a historical profile or
changing any previously valid program. Historical defaults/conversions remain
open in #58/#116; this slice does not complete classic-game compatibility.

## Evidence and deliberate native choices

The [BASIC-PLUS October 1972 manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
sections 3.6.2 and 5.1.2–5.1.3, documents parenthesized one/two-dimensional numeric
and string arrays, comma-separated DIM declarations with literal integer upper
bounds, zero elements, scalar/array coexistence and declarations placed after
references. The source review retains the downloaded scan's hash/provenance.
These forms cover the reviewed 1CHECK board operations.

Native arrays adopt those explicit forms, with the following bounded contract:

- `DIM A(64), BOARD(7,7), NAMES$(2)` declares independent arrays. Each bound is a
  nonnegative decimal integer literal, inclusive of zero. Unassigned elements
  contain `0` or `""` according to the name suffix. Scalars still require explicit
  assignment and remain separate from arrays of the same name.
- `A(I)=value`, `LET BOARD(I,J)=value` and indexed expression reads use the
  existing native value/expression rules. Indices must evaluate to finite,
  nonnegative safe integers within their declared bounds. Native rejects
  fractional indices; no historical conversion rule is inferred from that choice.
- DIM is contextual at statement position before an identifier. `DIM=4`,
  `LET DIM=4` and `PRINT DIM` remain valid scalar code; DIM may also name an array.
  Built-in functions remain reserved. An ordinary `NAME(...)` is an array
  reference, not an extensible user-function call.
- Whole-program validation collects every declaration before effects, including
  declarations after END or behind a jump. Duplicate declarations, undeclared
  arrays and inconsistent ranks fail before execution. DIM is inert when stepped
  and does not erase elements when reached repeatedly. Immediate DIM requires a
  complete program; standalone Evaluator callers supply declarations to reset.
- Validate all dimensions and safe products before allocation. Maximums are
  65,536 cells per array, 262,144 cells per program and 256 declared arrays.
  These are native resource limits, not historical machine limits. Fresh runs and
  separate instances have separate element storage. A rejected replacement
  retains the previous prepared snapshot for an explicit rerun.
- Reads evaluate indices left to right. Assignment retains the existing eager
  evaluator API: evaluate the right-hand value first, check its type, then resolve
  target indices left to right and commit one cell only after all checks pass.
  Declaration/rank checks precede evaluating indices. A failed write cannot alter
  an element; already consumed host effects are not rolled back.
- Existing scalar variable snapshots keep their shape. Separate immutable array
  snapshots expose name, inclusive bounds, element count and a copied prefix of
  values, with an explicit truncation flag. Prefix order changes the rightmost
  index fastest. Copy at most 64 cells per array and 256 cells across a snapshot;
  metadata is bounded by the declaration limit. The current browser Variables
  panel remains scalar-only; programs can inspect cells through PRINT.

The later [INPUT target extension](input-targets.md) now accepts indexed input
and mixed scalar/array lists through the same rank/bounds/evaluation rules.
Single indexed strings receive the raw response; lists use explicit field rules.
Integer `%` arrays, implicit dimensions, square brackets, MAT,
redimensioning and historical fractional-subscript rules are not enabled by this
slice. No source correction or historical compatibility pass is implied.

## Verification

Assert exact 1CHECK-style 48-piece initialization, an illegal move leaving it
unchanged and the legal 1-to-19 jump clearing 1/10 and setting 19 (47 remaining).
Use an independently authored feature program, explicitly separate from a raw
or corrected historical listing. Also cover string/2D storage, zero/upper edges,
same-name scalars, contextual DIM, failed assignments, rank/declaration/resource
errors, retained snapshots, reset/isolation, cancellation and source locations.
Exercise direct and installed ESM/CommonJS/type/CLI consumers and actual Chromium
against checkout and the exact extracted static artifact on Linux/macOS. The
separate corrected native 1CHECK path now exercises integer PRINT USING and
adjacent items too; historical formatting/profile work remains open in the
corpus ledger and #129/#109.
