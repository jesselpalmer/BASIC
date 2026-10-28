# Intrinsic function resolution

**Status:** evidence and implementation design for #123/#116, with the shared
name-resolution boundary needed by #59/#125. No new function, reserved word or
historical profile is enabled. #109 remains **NOT READY**.

## The native ambiguity is already observable

Native parses an ordinary identifier followed by parentheses as an array
reference. Existing reserved function names produce CallExpression nodes instead.
These are distinct public AST cases, with distinct validation and runtime errors.
Names such as SQR, EXP, SIN, LEFT and PI are currently ordinary native names.

For example, this valid native program prints `234` followed by a newline:

```bas
10 DIM SQR(1)
20 SQR=2
30 SQR(1)=3
40 EXP=4
50 PRINT SQR;SQR(1);EXP
```

The existing regression in `src/core/numeric-expressions.test.ts` also requires
undefined EXP to remain an undefined variable and RND(0) to retain its native
arity error. An undeclared SQR(4) is an array error, including in unreachable
complete-program source. Adding SQR to `reservedWords`, recognizing all familiar
names before arrays, or trying a function after array lookup fails changes these
contracts. Resolving by the presence of DIM is also unsuitable: single-line
editing and direct Evaluator use must not acquire a different parse when another
line is added. Do not add any of these fallbacks.

## Versioned evidence

The primary [BASIC-PLUS October 1972 manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
provides these facts:

| Location                                    | Established rule                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §2.5.2                                      | Elementary numeric variables use one letter, optionally followed by one digit.                                                                         |
| §3.7, table 3.1; appendix A.3               | ABS, SGN, INT, FIX, COS, SIN, TAN, ATN, SQR, EXP, LOG and LOG10 take one numeric argument. PI is bare; RND has bare and argument forms.                |
| §3.7.1                                      | INT floors; FIX truncates; SGN distinguishes negative, zero and positive.                                                                              |
| §3.7, table 3.1                             | Trigonometric arguments and ATN results use radians. LOG is natural; LOG10 is common logarithm.                                                        |
| Chapter 8, error table, entries 48/49/53/54 | Historical numeric errors can continue with replacement results. Nonpositive LOG returns its argument; negative SQR returns the root of its magnitude. |

The error table defeats a blanket policy of applying JavaScript Math functions
and throwing on NaN/Infinity. Exact range, continuation/reporting, precision and
error-trap interactions need their own contract before implementation. The
available OCR is unsuitable for settling the exact EXP limit numerals; inspect
the scan and floating-point appendix rather than copying an OCR bound.

This does not certify DECsystem-10, EduSystem, HP or later BASIC-PLUS rules.
In particular, the already reviewed BASIC-PLUS table 5-3 and
[DECsystem-10 March 1974 manual](https://bitsavers.org/pdf/dec/pdp10/TOPS10_softwareNotebooks/vol06/DEC-10-LBLMA-A-D_BASIC_Conversational_Language_Manual_Mar74.pdf)
§8.6 have different RIGHT/RIGHT$ meanings; see [dialect design](dialect-design.md).
String aliases and edge behavior remain #59 work, rather than entries inferred
from a numeric function table.

## Pinned corpus observations and independent oracles

All references below use commit
`45f75052be3f436f2e575f58d4aa611484268227` of
`maurymarkowitz/101-BASIC-Computer-Games`. Blob identities were read directly,
not inferred from feature searches. These are construct observations, not
platform attribution or whole-game passes.

| Source                                                                                                                                          | Git blob                                   | Observed use / proposed formula oracle                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| [3dplot.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/3dplot.bas), 5/130/150    | `aba4f5067423bb5d68727993d3123e890936717b` | EXP in DEF FNA and SQR in plot geometry. At Z=0 the defined formula is 30. At X=0 line 130 gives Y1=30.         |
| [rocket.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/rocket.bas), 41           | `ea34b625cfca9f4f57fbe6ca0f1c01c4cb047c8a` | SQR in free-fall time. With authored V=3, A=4, G=2, time S=1 independently satisfies A=V*S+G*S*S/2.             |
| [rockt2.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/rockt2.bas), 645/650/1035 | `22862fc7979f18d386f359e92dcbb0ab68e36a18` | SIN/COS attitude components and SQR impact speed. Authored D1=3, H1=4, G3=2 gives speed 10 by a 3-4-5 triangle. |
| [orbit.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/orbit.bas), 430            | `be7b8cc20fcdb7d811e631e1f1b96b1b4faeabc0` | SQR/COS in separation. Authored T=0, D=120, D1=100 gives distance 20 by collinear geometry.                     |

The authored inputs above are chosen oracle values, not original game defaults
or test results. Future fixtures must identify every changed space, separator,
call or scaffold. Do not repair other suspicious source lines to get a whole-game
pass. DEF FN, compact spelling, RNG, formatting and other dependencies remain
separate gates even when an isolated formula succeeds.

## First shared native signature slice

**Status:** implemented; design recorded before code. No historical functions are added.

The current native ABS, INT, RND, INKEY$ and KEYDOWN signatures have one
internal immutable owner in `core/intrinsics.ts`. An exhaustive canonical-name
lookup returns the recognized name, arity and result type; unknown names return
null. Each signature is frozen and carries no implementation callback. The
lexical reserved-word set remains separate and unchanged.

The parser uses this lookup only where it already recognizes native calls.
The evaluator uses it for the existing unknown-name and arity checks before
scheduling argument evaluation. Result-type inference uses its declared
result type, retaining the existing numeric fallback for unknown constructed
CallExpression names. No new whole-program call validation is introduced.

Preserve case-sensitive constructed call identities, exact diagnostic codes,
messages and name spans, and the current distinction between runtime arity/type
errors and existing keyboard preflight checks. Dead numeric call failures remain
unexecuted in unchosen clauses; a numeric arity failure after an earlier PRINT
remains a runtime failure after that output. Valid arguments evaluate once in
native left-to-right order; the first failure suppresses later host callbacks.
Existing direct function implementations and the iterative expression driver
remain in the evaluator. Do not add argument-type metadata until it has a real
consumer that preserves these error boundaries.

Verify all five calls through parser, inferred result type and evaluator,
including constructed unknown/prototype-like names, wrong arity before effects,
keyboard/random traces, native scalar/array names reserved for future functions,
source locations, dead-code timing, independent instances and deep expressions.
Compare existing source/AST/value/error behavior against the baseline. Installed
consumers and browser/archive checks remain required before publishing code.
This establishes the shared signature prerequisite for #123/#59/#116, not a new
historical profile or a whole-game pass; #109 remains NOT READY.

## Resolution contract for implementation

Use the existing immutable dialect carried by parser, Program, prepared snapshot
and Evaluator. Native keeps its exact lexer, names, ASTs and errors. Historical
resolution belongs exclusively to the explicitly selected, versioned profile;
the identities in dialect-design.md remain design identities until activation
is separately reviewed.

1. At expression position, resolve a profile's documented intrinsic spelling
   before interpreting its permitted variable/array grammar. A profile-specific
   intrinsic cannot be shadowed through DIM or assignment. Do not infer this
   rule for another profile or allow arbitrary unknown names as calls.
2. Emit the existing CallExpression shape with canonical function identity,
   actual nameLocation and physical span. Bare PI/RND can use empty argument
   lists without inventing source parentheses. Native bare PI stays a Variable;
   native PI(0) stays an ArrayReference. No AST is reinterpreted at execution.
3. Keep a small exhaustive signature function keyed by dialect and canonical
   identity: accepted syntax, arity, argument types, result type and support
   status. Share that information across parsing/preflight/type inference and
   evaluation; use a direct evaluator switch, not a dynamic function registry or
   user-supplied executable plugin. Resolve FN calls through #125's separate
   declaration/scope contract, rather than guessing from unknown intrinsics.
4. Check supported identity, arity and statically known argument types before
   evaluating arguments or invoking hosts. Whole-program preflight covers dead
   branches and source after END, and validates caller-constructed CallExpression
   trees under their declared context. Single-line editing may retain incomplete
   program references; it must still reject malformed call syntax. Preserve the
   established native boundary where its current behavior differs.
5. Make expressionType profile-aware before adding string results. Its current
   INKEY$ exception plus default numeric return is insufficient for LEFT/RIGHT,
   conversions or user-defined results. Array validation must see actual argument
   references, not confuse intrinsic argument lists with dimensions.
6. Extend the existing iterative evaluator, preserving native's single,
   left-to-right evaluation and first-failure behavior. Confirm any historical
   observable ordering separately, particularly for multiargument string/FN
   calls and RND arguments whose values are ignored; table syntax alone does not
   establish their side-effect order. Pure math adds no Host callback,
   asynchronous ownership, synthetic statement, Step or budget unit. Retain
   bounded expression nesting and nonrecursive flat traversal.
7. Apply the separately settled numeric policy after argument evaluation. Do not
   inherit native fatal errors, binary64 limits, negative zero, print precision
   or Math-library edge results by accident. A recognized but unsupported
   intrinsic/form must report a source-located unsupported-feature diagnostic;
   it must never fall back to native semantics or an ordinary array.

The signature mechanism is a concrete consistency boundary, not a reason to
refactor unrelated runtime dispatch. Numeric and string implementations can be
reviewed separately once resolution and result typing are shared.

## Acceptance and activation gate

Before adding a public profile or accepting its intrinsic calls:

- Retain native AST/value/error comparisons for all candidate scalar and array
  names, with and without DIM, in expressions and assignment/INPUT/READ targets.
  Include mixed case, substrings inside longer names, comments and quoted text.
- Test every admitted signature, bare/parenthesized distinction, wrong count,
  wrong type, unknown name and malformed/cyclic constructed tree. Preflight a
  dead invalid call before an earlier PRINT or host callback can occur.
- Assert an independent host trace for nested argument evaluation, invalid
  signatures, first failing arguments and unchosen IF clauses. Pin evaluation
  count and rerun/independent-instance behavior. RNG semantics stay separately
  owned; mathematical-call support must not alter native RND().
- Verify exact simple results (including the corpus-derived oracles above),
  negative/fractional INT-versus-FIX and zero SGN. Specify version-correct
  precision tolerances and independently checked transcendental reference
  values before testing boundary-sensitive game decisions. Do not assert only
  the same Math function used by the implementation.
- Settle positive/zero/negative domains, overflow/underflow, EXP range, tangent
  reduction near poles and continued-error reporting before accepting those
  paths. Unsupported/error-policy outcomes need explicit tests too.
- Prove original source/columns, immutable snapshots, atomic rejected loads,
  cancellation and clean reruns through direct/installed ESM/CommonJS, consumer
  types, CLI/editor and relevant browser/extracted-artifact scenarios. Re-run
  Linux/macOS checks for implemented code. Formula probes alone close no game.

The next code slice is blocked on the selected profile's lexical activation and
numeric/error contract, not on finding more JavaScript math primitives. This
document settles the namespace and integration direction; #123/#59/#115/#116
and full-corpus #129 remain open.
