# Canonical selected-MA2 value operations

Design before implementation for #123/#116. Complete the first-game numeric
kernel with internal INT, ABS, negation, numeric ordering and exact observations.
Keep source parsing, public evaluator/profile activation and native arithmetic
unchanged. This is a canonical two-word value boundary, not MA4 or a general
numeric plugin framework.

## Evidence and supported domain

Use the [pinned V4A-12 software MA2 build](rsts-v4a-build.md), loader SHA-256
`e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596`
and SIMH commit `698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6`.
The exact word decoder supplies canonical zero or a24-bit significand with
sign/exponent. Keep four-word precision and noncanonical exponent-zero patterns
explicitly unsupported; malformed containers/words retain decoder errors.

Capture INT/ABS/negation through an authored BASIC probe using CVT$F/CVTF$ words,
with exact LIST agreement and two identical final RUNs. INT's negative fractional
path returns through its original threaded evaluator continuation; jumping to
its internal body with an invented return address is not a completed INT call.
Use original CMPF at octal102264 separately for numeric-order machine vectors.
The manual's INT floor and ABS magnitude facts are not a substitute for these
selected-word boundary oracles.

## Operations and invariants

- INT rounds down to an integer-valued **MA2 float**, rather than converting to
  a signed16-bit integer. Already integral large values stay unchanged. For a
  fractional negative value, increment the truncated magnitude before restoring
  its sign; propagate a significand carry into the exponent. Tiny positive
  values become zero; tiny negative values become-1. Canonical inputs need no
  numeric event for these operations.
- ABS clears a nonzero value's sign; negation flips it. Zero remains canonical
  positive zero rather than manufacturing a signed-zero encoding.
- Numeric comparison returns ordering -1/0/1, not a BASIC logical word. Compare
  sign, zero, exponent and significand, reversing magnitudes for negatives.
  Validate left then right and stop on an unsupported left operand. Truth-word
  production and language comparison positions remain caller-owned.
- Canonical24-bit observations are exact finite binary64 numbers: a24-bit integer
  significand scaled by a power of two with magnitude within binary64's normal
  range. No rounding or arithmetic policy is selected by observing that value.
  Four-word values must not silently lose bits through Number.

Validate an unknown unary operation before reading operands. Read each word
once through the shared decoder; never iterate, retain or mutate caller arrays.
Return detached frozen word pairs and frozen result objects. Unsupported results
identify the domain boundary, and binary comparison identifies the operand.

## Acceptance and activation boundary

Use independently captured original-machine/BASIC vectors for signed zero/value
controls, fractional/exponent neighbors, INT normalization carry and integers
beyond the signed-word range. Assert comparisons in both orders/signs, equal and
zero operands, extrema and deterministic generated pairs. Verify observation
exactness by independently decoding binary64 output bits into a rational value,
not by calling the same conversion formula as the implementation. Include
malformed/unsupported/hostile inputs, frozen/detached results and operator-first
validation. Normal CI consumes offline fixtures and does not run the historical
OS/emulator. Public value/error observations, historical AST/raw-literal binding,
parser/runtime integration and full-game acceptance remain separate gates.
