# Selected-MA2 values in the shared interpreter

**Status:** concrete implementation design for #116/#123/#117/#129, following
merged source conversion, canonical unary/order/observation and caller evidence.
No public historical profile, AST kind, Host method or runtime behavior changes
in this document. Native remains the only executable profile; #109 is NOT READY.

## Immutable configuration and the first slice

Use the proposed execution identity `basic-plus-v4a12-ma2` for the pinned
[V4A-12 software MA2 build](rsts-v4a-build.md). The earlier
`basic-plus-1972-10` name identifies a manual revision and was never accepted;
it must not become an alias that hides the math-package decision. Do not infer
this configuration from a filename, an AST value, a host number or parse failure.
MA4, EAE variants and noncanonical exponent-zero encodings remain unsupported.
This experiment does not establish the original interpreter of 1CHECK.

The first eventual executable slice is the closed
[first-game support matrix](first-game-runtime-evidence.md), rather than every
construct in a manual. Keep the candidate rejected until all its accepted
lexical, statement, numeric, array, control-flow, input, output, event and
lifecycle rows are implemented together. READ/DATA, integer `%`, RNG, additional
intrinsics, FN, services and unsupported format images can remain preflight
rejections in that slice. They remain corpus blockers, not release exclusions.

## Representation decisions

| Boundary                              | Decision                                                                                  | Invariant                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Native expression/storage             | Existing finite `number` or `string`                                                      | Existing values, errors, names, arity timing and host calls stay unchanged.                        |
| Historical numeric expression/storage | Internal frozen `{kind: 'ma2', words: readonly [number, number]}`                         | Preserve canonical words after every operation and through scalars, arrays, loops and assignments. |
| Source numeric expression             | Proposed distinct `Ma2NumberLiteral` with unsigned `raw`, `words` and physical `location` | Never evaluate the host-number field of a native NumberLiteral as a historical source value.       |
| Structural labels/destinations/bounds | Existing bounded integer syntax and validated structural fields                           | A BASIC label is not a rounded floating expression. Preserve raw spelling and source location.     |
| Public BasicValue/snapshots           | Existing `number                                                                          | string`, with exact MA2 observation                                                                | Observation is a detached view, never the value used for subsequent arithmetic. |
| Public numeric injection              | Accept only finite numbers exactly representable as canonical MA2                         | Do not guess decimal spelling or silently round a host value.                                      |

The internal descriptor and proposed literal are closed tagged cases, not a
user-extensible numeric registry. Keep wrappers immutable and storage cells
execution-owned. Zero is canonical `[0,0]`; share a frozen zero descriptor if
useful, while allocating fresh cell arrays on every run. Preserve separate
scalar and array namespaces and configured array/default rules. Word/index and
string policies still belong to their corresponding owners.

All canonical 24-bit MA2 values are finite and exact in binary64. The merged
[observation primitive](basic-plus-ma2-values.md) proves that across every stored
exponent and both signs; it does not permit binary64 arithmetic in this profile.
MA4 and unsupported encodings must never enter this observation path through
truncation, Math.fround or a generic Number fallback.

## Shared parsing and preparation

Extend the existing Parser through a closed internal policy, then expose it only
with the complete supported execution context. Use the existing historical
scanner vocabulary/raw spans. Do not create a second parser, translate BASIC
source, strip spaces globally or add an internal-policy-shaped public option.

The historical scanner currently also computes a host numeric token value.
Replace that dependency in the integration stage with a distinct raw numeric
token case whose value is null and whose raw text/lexical kind carries the
spelling. Do not change native NUMBER tokens. The parser reads a raw historical
numeric token either as an expression constant or, at a structural destination/
bound position, through that position's bounded integer grammar. Update the
exported closed Token union, scanner tests and consumer type tests together;
internal scanner conformance is not permission to expose the token as execution.

For **expression** constants in the selected configuration, emit a distinct
`Ma2NumberLiteral` containing the complete unsigned raw spelling, converted
canonical words and original physical location. Keep source unary signs as
UnaryExpressions. Use the source converter directly on raw text, before host
Number conversion; `1.0000001` must bind to exactly 1 in this selected build even
though native source observes a different finite number. Integer `%` remains
rejected in the first slice. Structural destinations and DIM bounds retain their
own integer-only grammar instead of acquiring this expression literal kind.

The new AST kind is a deliberate public closed-union change when implemented:
update every exhaustive switch, token/literal kind check, type inference, copying, validation, prepared
instruction traversal and consumer type test in the same PR. Native Parser
output must remain byte-for-byte/structurally equivalent for existing source.
Native validation rejects the historical literal kind even in unreachable code.
A selected historical expression rejects an ordinary NumberLiteral instead of
reinterpreting its value as words. Direct Evaluator calls enforce the same rule.

On historical caller-supplied trees, validate the declared root and every line,
raw grammar, kind, word count/canonical domain, raw-to-word equality and physical
spans before effects. Do not trust a claimed converted value or retain a caller
array. Bound raw spelling before conversion, read each supplied word once, then
freeze independent words/nodes. Validate all expressions, including dead clauses
and source after END; unsupported conversion statuses/events fail preparation
until their required caller policy is implemented. An unknown/conflicting
context remains an option error, not a fallback parse. Replacement remains
atomic: a failed preparation leaves the old source/context/prepared snapshot.

## One evaluator and execution-owned storage

Extend the current iterative Evaluator's private value stack and storage with
the MA2 descriptor. Keep public methods separate from private operations:

- Internal evaluate/assign/read/write paths carry descriptors. Scalar or array
  assignment never observes a number and reconstructs it afterward.
- The existing arithmetic switch dispatches explicitly by immutable context:
  selected `+ - * /` use the captured MA2 operations; unary sign, INT and ABS use
  canonical word operations; numeric conditions use exact word ordering.
  String relations use the selected byte/padding rules. Unimplemented operators,
  kinds, calls or formats fail preflight with their physical source locations.
- Result-type inference and intrinsic resolution use the same supported identity,
  arity and result-kind inventory as preparation. No unknown function/array
  fallback is allowed. A known but unsupported form is rejected before effects.
- Array cells, loop limits/steps/index state and future argument frames retain
  words. Index conversion is an explicit policy with separate conversion and
  bounds failures; never route an index through native integer guards by chance.
- Preserve iterative flat traversal, nesting/work limits and established native
  operand order. Historical observable argument/operand order needs its own
  verified support rule before effectful forms are accepted. Pure numeric work
  creates no host callback, synthetic instruction or extra Step/budget unit.

Run reset, terminal cleanup, cancellation and replacement continue through the
existing runtime/generation owners. No alternate interpreter is introduced.
The six captured loop paths do not settle nested, repeated-entry, overflow or
call/unwind behavior; implement/test the accepted subset in the existing owner.

## Public observation and injection

Keep BasicValue, VariableSnapshot and ArraySnapshot values as `number | string`
for this canonical MA2 configuration. Observe words only at public results and
debugger/snapshot boundaries through the exact primitive, producing detached
frozen snapshots. A returned number must never alias mutable internal storage,
change future arithmetic or imply that native and historical semantics agree.
Debuggers can display exact numeric observations; expose context separately
through the existing immutable dialect owner. A future word-inspection API
would be a separate review, not a silent change to BasicValue.

Public `Evaluator.evaluate` returns an observation while the private evaluation
entry used by runtime statements retains descriptors. The existing public
`assign(target, BasicValue)` is a host injection boundary, not the private
assignment method used by BASIC execution. In the selected profile, accept a
numeric injection only if its binary64 value has an exact canonical MA2 encoding
(including canonicalizing host -0 to zero). Reject non-finite, out-of-range or
extra-significand-bit values with a source-located unsupported-value diagnostic
before assignment/index effects. For example 1 and the exact MA2 observation of
an earlier value round-trip; native binary64 `1.0000001` is rejected rather than
converted using an invented decimal string. Native assign behavior is unchanged.
String injection must pass the selected byte/length contract. No public
arbitrary object or raw word array is accepted as a BasicValue.

INPUT consumes original response text through its separately settled row/parser
policy and stores converted words directly. Host.random is not repurposed as a
historical seed/sequence service. PRINT consumes internal values using a selected
formatter; exact public Number observation is not historical decimal formatting.
The existing CLI/browser source envelope carries the explicit configuration;
import/export and editing preserve the original source without source rewrites.

## Events and remaining gates

Arithmetic primitives supply event identity and independently captured
continuation words. Conversion caller observations distinguish error 48 from 52
and trapped READ cursor state. Neither defines arbitrary expression unwinding,
untrapped diagnostic order, handler entry, RESUME/retry or callback failures.
Keep those policies execution-owned, source-located and separate from pure
numeric values. Machine trap counts must not become diagnostic counts by guess.
Do not expose a profile that silently treats a historical continuable error as
native fatal failure or discards a diagnostic. The current terminal-only
RunResult.diagnostic cannot represent a continued event by itself; settle and
verify its observation/host contract before adding public API for that flow.

| Delivery stage                            | Required proof before proceeding                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context + literal/preparation integration | New literal kind handled exhaustively; raw/word agreement; supplied hostile/dead trees rejected; native AST/error comparisons and no partial replacement.                       |
| Shared values + scalar/array evaluation   | Original-machine arithmetic/unary/order fixtures; word preservation through every intermediate/cell; exact observations and injection rejection; native host/evaluation traces. |
| Closed first-game execution               | Every matrix row implemented, including input, formatting, defaults, indices, loop transfer and event/diagnostic policy; unsupported source rejected before effects.            |
| Acceptance and selection                  | Direct/installed ESM/CommonJS, CLI/editor and actual browser tests, Step/Stop/retry/rerun/replacement, illegal inputs and exact extracted artifacts on Linux/macOS.             |

Design review deliberately rejects a Number-only numeric policy, assignment-only
rounding, a WeakMap/global literal cache, a hidden native historical Program,
parallel parser/evaluator and a generic plugin API. Distinct literal identity
makes unsupported source/tree rejection explicit; exact public observations
preserve the current BasicValue boundary without losing selected-MA2 bits.
This settles the proposed representation/observation direction, not the remaining
execution evidence. All 108 corpus dispositions and zero certified historical
passes remain unchanged; compatibility parents stay open.

## First scanner stage implemented

The [raw numeric token delivery](historical-raw-numbers.md) now emits RAW_NUMBER
with null values under the internal historical scanner policy. Its spelling
classifier retains raw/kind facts without host-number conversion, including
lexically valid magnitudes beyond binary64. Native tokens and public historical
context rejection remain unchanged. Distinct historical expression literals,
supplied-tree/preparation integration and shared word storage are still the next
stages; raw tokens are not executable programs.
