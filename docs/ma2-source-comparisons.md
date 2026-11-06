# Numeric comparison source through the shared owners

Design before implementation for #116/#117/#123. Extract the existing Parser's
IF comparison grammar into one shared method and add an internal numeric MA2
comparison-conformance entry. It consumes exactly two numeric expressions and
one of = <> < <= > >=, preserves physical operand/operator spans, freezes the
result and rejects trailing/chained or unsupported syntax. Native IF/inline
conditional grammar, nesting and diagnostics remain unchanged.

Extend the existing internal scalar session with comparison of that parsed source.
Preflight both operand trees before calculation; arrays, strings, integer kinds,
unsupported operators/intrinsics remain rejected. Evaluate left then right on the
same iterative driver and stored descriptors. An operand numeric event returns
unchanged with its original location/continuation and prevents later calculation.
Normal operands feed the merged exact MA2 relation binding; return its immutable
boolean and comparison-operator location. Comparison never changes scalar cells.
This is deterministic conformance order, not a claim of general BASIC handler,
effectful argument, IF transfer or statement semantics.

Verify all six source operators with scalar signs/zeros/neighbors/extrema, joins
of retained decimal/CMPF captures, malformed/chained/unsupported input, physical
spans, whole-condition preflight before events, left/right event identity,
immutable results, no writes and native IF/callback behavior. Keep public
historical context and conformance exports rejected in installed/browser/type
consumers. No historical Program, IF execution, string relation or release/game
certification is added; the remaining first-game matrix stays gated.

## Implemented evidence

The 760 tests exercise six parsed scalar predicates for each of 755 retained CMPF
pairs, then literal-source joins between independent decimal/CMPF captures,
physical immutable spans/results, full-input/unsupported preflight, operand events
and native IF/callback behavior. The thirteenth installed/browser embedding
scenario retains private conformance exports and native IF operand order. These
are binding checks against existing captures, not new machine/game evidence.
