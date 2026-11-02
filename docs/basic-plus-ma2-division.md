# Internal V4A MA2 division

Design and machine evidence before implementation for #123/#116/#128. Extend the
existing internal MA2 arithmetic owner with canonical two-word division, leaving
native arithmetic and public profile activation unchanged. Read completed values
at returned R1 and retain numeric events separately from successful values.

## Evidence and algorithm

Use the [pinned V4A-12 MA2 build](rsts-v4a-build.md), SY.LDA SHA-256
`e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596`,
SIMH commit `698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6`, CPU11/05 and64K.
The traced division entry is octal101514, completion102042, range TRAP0101714
and zero-divisor TRAP0101704. These identify this exact linked build.

The original restoring division at102050 produces quotient bits through signed
exponent extraction, significand comparison/normalization and a25-bit quotient
with one rounding guard. Exact remainders take an early exit that fills the
remaining quotient bits with zeros. Canonical24-bit operands support an equivalent
bounded integer algorithm:

1. Decode both operands, left then right, before any zero shortcut. A zero
   divisor takes precedence over a zero dividend, including0/0. Noncanonical
   exponent-zero patterns and four-word precision stay explicitly unsupported.
2. A zero dividend with nonzero divisor returns canonical zero normally.
3. Let L/R be restored24-bit significands and eL/eR stored exponents. When
   L>=R, set exponent eL-eR+129 and integer numerator L*2^23; otherwise set
   exponent eL-eR+128 and numerator L*2^24. Normalize before range decisions.
4. Exponents below1 or above255 produce event48, underflow or overflow, with
   zero completed continuation words. Otherwise compute integer quotient and
   remainder, rounding magnitude upward when twice the remainder is at least R.
   Sign is operand-sign XOR. All operands/intermediates are exact integers below
   2^48; the quotient and remainder retain the original routine's guard decision.

The resulting significand stays in [2^23,2^24). For canonical operands, the
largest normalized ratio is (2^24-1)/2^23; a rounded significand cannot carry
past2^24. There is no invented universal arithmetic policy: multiplication's
ordered partial products and addition's signed alignment remain separate.

## Events and completion boundary

The October1972 BASIC-PLUS manual, §8.4/error table printed8-9 (PDF101),
identifies **error61, division by zero**, as continuable with zero when no handler
transfer occurs. Printed8-8/PDF100 separately identifies range error48; error50
is unassigned and must not be guessed from numeric adjacency. These pages were
visually reviewed in the already hash-pinned manual from the source review.

Extend the result union with a discriminated numeric event `code:61`,
`reason:'division-by-zero'`, and frozen zero `continuationWords`. Existing event48
keeps only overflow/underflow reasons. Never discard an event because its words
are zero. Host diagnostics, source locations, ON ERROR/RESUME and expression
unwinding remain execution-owned and are not enabled by this internal helper.

The original monitor handler skips inline mask100006 after division-by-zero
TRAP0, versus100002 after the range TRAP0. Run through that unchanged handler,
with data word4064 selecting a separate scratch latch140020. Both normal and
captured exceptional calls return R1=140004; read words140004/140006 only at
completion102042. Neither inline mask is executable code. Keep masks, pointers
and instruction histories in research evidence, outside the runtime result API.

## Independent acceptance

Capture original-machine results for all signs, zeros including0/0, both operand
orders, equal and unequal significands, exact early exits, recurring quotients,
rounding neighbors and exponent endpoints. Include deterministic generated
inputs. A second pass must independently finish every exceptional call through
the real handler, retaining zero words, returned pointers, masks and complete
bounded histories. Expected words must come from SIMH, never from the helper.
Retain a standalone standard-library capture command with pinned loader checks;
CI consumes its offline fixture without emulator/OS binaries or network access.

Preserve existing addition/subtraction/multiplication fixtures, input validation,
operator-first rejection, detached/frozen results and native/installed/browser
acceptance. No historical profile, game certification or release approval follows.
