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
The exact word decoder supplies canonical zero or a 24-bit significand with
sign/exponent. Keep four-word precision and noncanonical exponent-zero patterns
explicitly unsupported; malformed containers/words retain decoder errors.

Capture INT/ABS/negation through an authored BASIC probe using CVT$F/CVTF$ words,
with exact LIST agreement and two identical final RUNs. INT's negative fractional
path returns through its original threaded evaluator continuation; jumping to
its internal body with an invented return address is not a completed INT call.
Use original CMPF at octal 102264 separately for numeric-order machine vectors.
The manual's INT floor and ABS magnitude facts are not a substitute for these
selected-word boundary oracles.

## Operations and invariants

- INT rounds down to an integer-valued **MA2 float**, rather than converting to
  a signed 16-bit integer. Already integral large values stay unchanged. For a
  fractional negative value, increment the truncated magnitude before restoring
  its sign; propagate a significand carry into the exponent. Tiny positive
  values become zero; tiny negative values become -1. Canonical inputs need no
  numeric event for these operations.
- ABS clears a nonzero value's sign; negation flips it. Zero remains canonical
  positive zero rather than manufacturing a signed-zero encoding.
- Numeric comparison returns ordering -1/0/1, not a BASIC logical word. Compare
  sign, zero, exponent and significand, reversing magnitudes for negatives.
  Validate left then right and stop on an unsupported left operand. Truth-word
  production and language comparison positions remain caller-owned.
- Canonical24-bit observations are exact finite binary64 numbers: a 24-bit integer
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

## Captured acceptance evidence

The [authored BASIC source](ma2-values-probe.bas) has 210 physical/numbered
lines. Its selected installation LIST matched all 210 lines exactly. Two final
RUN bodies each contain 195 result rows and FINISHED, with identical
[normalized output](ma2-values-output.txt). The fixture pins source/output hashes
and every result. There are 65 inputs (canonical zero; exponents
1/127/128/129/130/150/151/152/153/255, fraction fields 0/1/0x7fffff, both signs;
then ±1.5 and ±2.5), each applied to ABS, negation and INT. CVTF$ bytes
`a,b,c,d` reconstruct memory words `[c*256+d,a*256+b]`, as independently
calibrated in the selected conversion-string evidence.

The retained reference has a manually entered clock, missing INIT and unreliable
save/filesystem behavior described in [first-game observations](first-game-runtime-evidence.md).
These calls observe internal numeric state; normalized PRINT is transport and
does not certify terminal formatting, defaults, files, RNG or a public dialect.

The [CMPF capture script](../scripts/research/capture-ma2-comparisons.py) makes
755 calls: 345 less, 65 equal and 345 greater. It supplies right words at
140000/140002, left at 140004/140006, R1=140000, SP=150000 and a return to
140100; all other registers and PSW start zero. Execution starts at the original
102264 entry, with a 1000 instruction bound, and must reach the 140100 breakpoint
with R1=140004. Order comes from signed R0; PSW independently records 8/4/0.
Only scratch operand/return memory is deposited; no original instructions are
patched. The selection pairs each unary input with zero, ±1, itself and its
next neighbor in both orders, then adds 96 generated pairs and their reverses
(LCG seed 20261104, multiplier 1664525, increment 1013904223, modulus 2^32),
deduplicating first occurrences. The script defines byte-exact generation.

To reproduce the comparison section, obtain the pinned simulator and loader
separately, then run:

```sh
python scripts/research/capture-ma2-comparisons.py \
  --simulator /path/to/pdp11 --loader /path/to/SY.LDA \
  --output /tmp/comparison.json
```

Compare its metadata to `comparisonCapture` and its rows to `comparisonRows` in
`src/core/__tests__/ma2-values-reference.json`. To reproduce the unary section,
boot the qualified reference, enter the authored probe, compare LIST exactly and
RUN twice. Exclude dynamic RUN headers/Ready, normalize CRLF to LF and remove
trailing ASCII spaces per line, retaining one final LF. No binary or historical
OS is downloaded or run by CI.

Offline tests compare all 950 captured results and independently decode binary64
observation bits across both signs, all 255 stored exponents and three fraction
patterns (1530 nonzero observations). Public AST/raw-literal binding, function
signatures, truth-word production, errors, profile activation and historical game
acceptance remain blocked. This internal primitive adds no certified game pass.
