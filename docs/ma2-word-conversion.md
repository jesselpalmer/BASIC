# Exact MA2 to signed-word conversion facts

Design before implementation for #123/#126. Add a pure internal conversion of a
canonical selected-MA2 word pair to its mathematical truncation toward zero,
returning the signed 16-bit integer only when the truncated result lies within
-32768..32767. Use exact decoded significand/exponent integers; do not round,
wrap, saturate, choose assignment semantics or pass through host float arithmetic.
Keep MA4 and noncanonical encodings unsupported, strict input validation/read-once
snapshots in the existing decoder, and detached frozen conversion outcomes.

This supplies a conversion fact needed by later index handling. It does not
implement a historical array access, select BASIC error 51/55, infer an untrapped
replacement value or settle every historical normalization/range boundary.
Signed-word representability and array bounds are separate questions. In
particular, a representable integer outside A(0..3) is still a bounds failure.

Verify all 32 retained first-game subscript observations by binding their original
source spellings, separating representability from the observed cell/bounds
result. These are existing observations, not new machine captures. Independently
check exact rational values over every stored exponent/both signs, fractions and
signed endpoints; those mathematical edge tests are not claims that the machine
was observed at every boundary. Include hostile/malformed/noncanonical words,
no coercion/iteration, canonical zero, immutable results, source limits and
unchanged native fractional-index rejection. Before historical array activation,
prove and bind the remaining index/error/normalization matrix in the shared owners.
