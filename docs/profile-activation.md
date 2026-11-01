# Historical profile activation and compact lexing

**Status:** design for #116/#117; the first internal scanner-conformance stage is
implemented in [scanner conformance](scanner-conformance.md). `Dialect` still
accepts only `native`. The portable document/CLI persistence mechanism preserves
that context without enabling a historical runtime profile or `--dialect`
option. #115/#129 remain open and #109 is NOT READY.

## Decision

Do not expose a BASIC-PLUS choice by combining compact tokenization with the
native evaluator. Activation needs one closed, tested contract for every accepted
form. Unsupported features must fail before program effects, including in dead
branches and caller-supplied trees. An unknown profile remains an option error;
an unsupported feature in a supported profile is a source-located diagnostic.

Use the candidate identity `basic-plus-1972-10` for this design only. Keep native
as the default, preserve legacy missing metadata as native, and never infer a
profile from a filename, an abbreviation, a parse failure or a corpus README.
The proposed identity names a manual revision, not full RSTS or PDP-11 emulation.

## Evidence and its limits

Primary reference:
[BASIC-PLUS Language Manual, October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf).
Section references below identify printed sections, not PDF page indexes.

| Section             | Verified rule relevant to activation                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2.2, 2.4, 2.5.2     | Labels are 1..32767; compact spacing is demonstrated; numeric names are one letter, optionally followed by one digit.  |
| 2.3.1, 2.3.2        | Colons separate statements; terminal LINE FEED permits continuation between language elements.                         |
| 3.1, 5.1.1          | REM consumes the remainder; `!` comments have a DATA exception; strings allow single or double delimiters.             |
| 2.5.2, 3.6.2, 5.1.2 | Numeric/string defaults are zero/empty; undeclared arrays default to upper bound 10.                                   |
| 3.3.2               | Numeric PRINT has sign padding and trailing space; commas use 14-column zones.                                         |
| 3.6.1               | A completed FOR retains its last in-range value; a previously left unfinished loop permits reentry.                    |
| 3.7.1, 3.7.2        | Bare RND and RND(X) exist; X is ignored; ordinary RUN repeats a sequence; RANDOM/RANDOMIZE changes its starting point. |
| 5.2, 6, Appendix F  | String comparison, integer arithmetic and numeric representation have their own historical rules.                      |

These facts do not settle a complete lexical automaton, every numeric rounding
edge or every corpus dialect. In particular, free spacing is not evidence for
arbitrary abbreviations or a universal longest-keyword-prefix rule. Review
ambiguous spellings against primary examples before accepting them.

Pinned corpus evidence uses commit
`45f75052be3f436f2e575f58d4aa611484268227`:

| Source                                                                                                                      | Blob                                       | Observed forms and boundary                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [AWARI](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/awari.bas) | `8383e000bc6e9d8a18e2b9c4070dac541eb1df30` | Lines 5/10/15 have DATA0, DIMB and FORI=0TON-1; line 605 has FORP=PTO1STEP-1. Backslashes and the missing initial DATA stay separate blockers.                                                                                       |
| [LIFE2](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/life2.bas) | `167aa165fe0e44e46829779d3a79c0a561b66c5c` | N1/O1 names and IFJ<>0THENIFJ<>6THEN105 exercise short names and adjacent verbs. Lines 510/511 spell TO as T0; the [source review](classic-source-review.md#life2) records the scan-backed difference while preserving raw spelling. |
| [HELLO](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/hello.bas) | `ca074a45adc26fbea6ec3fd5a0b0d8b5803130a8` | PRI/INP/GOT and unterminated strings are present. Its text identifies EDUSYSTEM-25; that is not BASIC-PLUS abbreviation evidence.                                                                                                    |
| [QUEEN](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/queen.bas) | `28cea3499a9b4be715446daa2db57ed60adf5d53` | GO SUB, bare RND and label 99999 appear; that label exceeds this manual's range. Duplicate labels also require source review.                                                                                                        |

These are source observations, not complete dialect attribution or execution
results. Do not repair T0 into TO, add AWARI data, accept every abbreviation or
raise BASIC-PLUS's label limit merely to make a listing parse. Existing native
AWARI/LIFE2 probes retain their separately documented normalization boundaries.

## Scanner and parser boundary

Keep one scanner and parser with an immutable policy selected at construction.
Do not mutate the global native `reservedWords` set or preprocess source with
space stripping, keyword replacement, line joining or synthesized labels.

The native policy in `parser/tokenizer.ts` consumes a whole nonwhitespace label
and a whole alphanumeric name/number. The internal historical policy now has
separate label/name/number, string/comment and DATA paths as documented in
[scanner conformance](scanner-conformance.md). Public historical parser/AST
integration is still pending. Native paths must retain their
current spelling and errors: FORWARD, INTEGER, SCORE, ELSE, DATA and SQR remain
valid native names wherever they are valid today.

For the historical policy, distinguish statement verbs, expression functions,
operators, short variable names and grammar delimiters. Settle precedence at each
grammar position; a keyword found somewhere inside a word is insufficient.
Examples to trace before coding include FOR + I, IF + E, READ + N, P + TO + 1,
N1 + `(` and 1E-3 versus E3. Do not reinterpret an unknown long word as a valid
long historical identifier. Reject ambiguous or unsupported token sequences
instead of falling back to native scanning. Function/array resolution must
coordinate with #123/#59 rather than depending on runtime variable existence.

Retain every token's raw spelling and physical UTF-16 start/end offsets. An
adjacent label/verb must produce separate spans into the original source. A token
whose verified spelling contains whitespace may have a span including it; its
semantic value may be canonical while `raw` remains exact. Quoted text, REM,
DATA and format images need their own modes so apparent keywords stay literal.
Bound lookahead and token work linearly; repeated failed prefix scans must not
make a long malformed line quadratic.

Do not equate historical terminal LINE FEED with every LF in a modern `.bas`
file. Establish how each source represents continuation first, including CRLF,
numbered lines and unnumbered physical lines. Never join an invalid line as a
recovery heuristic. Backslash separators, abbreviations, alternate quote escapes,
case conversion and whitespace inside language elements need explicit positive
and negative conformance cases before activation.

## Runtime policy must accompany accepted syntax

The [integer/comparison contract](integer-semantics.md) and
[numeric representation contract](numeric-representation.md) refine this gate with
scan-verified word conversion, mixed-mode literals, float-package configuration
and observable continued-error requirements. Neither activates a profile.

The native implementation has several incompatible behaviors even for syntax
shared with BASIC-PLUS. Native undefined scalar reads fail; numeric output is
compact; arrays require DIM; RND() delegates to the host; string equality compares
exact strings. `ControlFlow.nextLoop` writes the incremented out-of-range value
when a loop completes, and native jumps discard exited loop frames. A historical
label must not route those operations through unchanged native semantics.

Create a closed support matrix owned by the selected profile. Each row identifies
an AST form, its expression/value kinds, preparation checks, execution policy,
source evidence and observable oracle. This is an exhaustive implementation
checklist, not a public plugin framework or a flag for every possible behavior.
Missing rows reject with an `UNSUPPORTED_DIALECT_FEATURE` diagnostic at the actual
form. Reuse a native implementation only when its behavior is independently
verified to satisfy that row. Do not validate just statement names: numeric
literals, operators, functions, type suffixes, array access and comparison all
carry semantics too. A reject-all numeric policy cannot accidentally allow
numeric assignment inside an otherwise supported IF or PRINT.

| Owner                                         | Required activation responsibility                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/dialect.ts`, `core/types.ts`            | Validate supported identities separately from expected context; preserve the immutable instance/Program/Line match and legacy-native meaning.                         |
| `parser/program_validation.ts`                | Enforce profile labels, names and support rows on complete trees, including unreachable clauses and externally constructed nodes, before copying/freezing or effects. |
| `core/prepared_program.ts`                    | Keep selected policy, validated snapshot and all derived tables consistent; unsupported preparation preserves the old loaded program.                                 |
| `core/evaluator.ts`, arrays/data/input owners | Implement defaults, numeric representation/conversion, name resolution, comparison and row/data rules under that profile; retain fresh run-owned state.               |
| `core/control_flow.ts`                        | Settle and implement loop completion, exit/reentry and suspended call ownership without changing native guards.                                                       |
| PRINT and RNG owners                          | Own profile output cursor/number formatting and reproducible per-run random state; host entropy is a capability, not an implicit native RNG fallback.                 |

Resource caps may be deliberate implementation limits with clear diagnostics.
They must not silently change a value, truncate a listing or replace an uncertain
historical rule. Exact floating-point representation/rounding, integer overflow,
fractional subscripts, RNG sequence and remaining loop/call cases are release
blockers where required; finite JavaScript doubles are not automatic historical
emulation. Keep error locations and statement budgets attached to real source
instructions, with generation/cancellation checks at the existing await sites.

## Activation sequence and verification

1. Extract internal lexical/validation policy seams while keeping public
   `Dialect = 'native'`. Prove existing native ASTs, names, diagnostics and all
   examples unchanged. Exercise verified historical token cases in internal
   conformance tests without accepting a historical Program in the public API.
2. Settle the support matrix and implement a useful complete vertical slice,
   including accepted forms' value/output/loop behavior. The corrected 1CHECK
   oracle is a candidate; it still requires exact historical output/subscripts
   and source certification. Do not call it an unchanged-source pass.
3. Expose the named profile only after that slice passes parser, constructed-tree,
   evaluator and runtime tests. Verify known unsupported syntax and shared-looking
   unsupported semantics fail before a host write, input request, draw or random
   call, including after END and in unchosen branches. Keep every excluded form
   explicit in the profile documentation and corpus ledger.
4. Extend the implemented native portable envelope through historical CLI file
   execution, terminal document state and browser selection only after activation.
   Reuse the atomic source/profile replacement contract in
   [dialect design](dialect-design.md#files-terminal-and-browser); a plain .bas
   export still requires explicit receiving selection. Reject a profile-bearing
   document where that host does not yet support preserving its context.
5. Validate exact-source import/LIST/save/export/reload, physical spans under
   compact spelling and continuation, native/historical interleaving across
   independent instances, failed context replacement, reruns, Stop, gates and
   instruction limits. Run installed ESM/CommonJS/types/CLI and actual browser
   cases against checkout and exact archives on Linux/macOS before delivery.

Lexical probes must assert independent token boundaries and locations, not only
that parsing succeeds. Pair each compact positive case with literal/comment/DATA
protection, malformed-label/number/name and native-name counterexamples. Include
inclusive label limits, type suffixes, mixed contexts and a bounded adversarial
long line. Runtime oracles must distinguish completed-loop values, exited-loop
reentry, padded numeric output, string comparison and repeatable RNG behavior
from native results. Passing a short lexical fixture does not certify a profile
or any whole game. All 108 corpus dispositions remain required.
