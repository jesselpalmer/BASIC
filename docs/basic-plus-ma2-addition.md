# Internal V4A MA2 addition and subtraction

Design before implementation for #123/#116. This slice computes only canonical
normal 24-bit MA2 word addition/subtraction and identifies range events. It does not activate a historical dialect,
change native arithmetic, parse literals, implement MA4, or install error traps.

## Evidence and algorithm

The [selected V4A-12 build](rsts-v4a-build.md) pins MA2.OBJ and its linked code.
ADDF is at octal100332, SUBF at100326, in that build's load map. The linked SY
absolute-loader payload has SHA-256
`e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596`;
the independently checked 65536-byte loaded image has SHA-256
`5ca10d4d7d52c0891ddea9df9437323d597d00a1479fedfb7d3cd1b9657b8686`.
These addresses identify this exact linked build, not portable entry points.

The routine trace resolves the apparent conflicting halfway results:

1. Extract sign/exponent and restore the hidden bit. Keep one extra low guard
   bit, giving 25-bit integer significands. SUBF changes the right operand's
   sign before entering the same addition routine.
2. Select the larger exponent. Negate the smaller significand for unlike signs,
   then align it with an arithmetic right shift (floor for negative integers).
   Exponent gaps greater than25 discard the smaller operand altogether.
3. Add the aligned integers. A same-sign carry shifts right once and increases
   the exponent. Opposite-sign results take the absolute magnitude, choose the
   resulting sign, and normalize left; exact cancellation becomes canonical zero.
4. Reject a nonzero result normalized below exponent1. Discard the low guard bit
   and increment magnitude if it was set. Propagate a rounding carry into the
   exponent; exponent256 is overflow. Return numeric event48 without numeric
   continuation words for a range event. Diagnostic/trap/continuation ownership
   remains separate.

This is operation-specific guard/alignment behavior, not exact rational addition
followed by one universal rounding rule. In particular, arithmetic alignment of a
negative smaller operand can lose precision before left normalization. There is
no sticky-bit accumulator. All intermediate integers are bounded below2^26 and
are exactly representable in binary64; using bounded integer arithmetic is not a
fallback to native floating-point arithmetic.

## Boundary and results

Use the existing exact word decoder once per operand, left then right. Malformed
containers/words keep its TypeError/RangeError behavior. Four-word inputs and
noncanonical exponent-zero patterns return explicit unsupported outcomes with
the operand identified; an unsupported left operand stops before reading right.
Reject an unknown operation before reading operands. Never use an input iterator
or retain a caller-owned buffer. Supported results contain frozen unsigned
16-bit word pairs in the decoder's increasing-address order. Zero is `[0,0]`.

Return either a value, an unsupported outcome, or a range event carrying code48
and overflow/underflow identity, **without numeric continuation words**. No source
location, host diagnostic, handler transfer or RESUME state is invented here.
The machine harness stops before executing the trap. Additional actual BASIC
checks contradicted the initial design assumption that every range continuation
is zero: maximum-plus-maximum reports FLOATING POINT ERROR and returns nonzero
CVTF$ bytes `[255,255,0,255]`, while rounding into overflow and the tested tiny
subtractions return zero. The manual's general zero statement does not resolve
this operation-path difference. Callers must settle continuation separately;
they cannot treat a range event as a successfully computed zero.

## Independent acceptance

Run the original linked routine in the pinned SIMH revision, with the right
operand at scratch octal140000 and left operand at140004, R1=140000, SP=150000,
and PSW=0. Use a10000-instruction step bound. Break at normal return100732,
overflow trap100742, or underflow trap101026, and read the result at140004/140006
only for normal returns. Reset operands/registers for every case. Do not patch
historical instructions or compare a helper against itself.

Cover zero/cancellation, both operand orders/signs, same/unequal exponents,
normalization, exponent gaps through and beyond25, low-word carry, rounding carry,
minimum/maximum exponents and both range traps. Keep deterministic generated
cases and their raw machine-word outcomes as offline fixtures, separate from
BASIC conversion-string bytes. Validate malformed/unsupported operands,
operator rejection, bounded getters and frozen/detached results in normal tests.
Existing native/direct/installed/CLI/browser acceptance and coverage floors must
remain unchanged. No full-game pass or release readiness follows.

## Captured acceptance records

The offline [machine vectors](../src/core/__tests__/ma2-addition-reference.json)
contain494 independently captured calls:478 normal word results,10 overflow
traps and6 underflow traps. The eight columns identify both unsigned word pairs,
operation (0 add/1 subtract), outcome (0 normal/1 overflow/2 underflow), and normal
result words. Trap rows have null result fields; scratch memory at a trap is not
a completed result. The metadata pins the loader and simulator, alignment/edge
selection and fixed LCG seed. The generated result rows are test oracles, not
outputs calculated by the TypeScript helper; CI consumes them offline.

A fresh boot using the pinned raw system image and the documented manual clock
step ran the separate [six-case BASIC probe](rsts-v4a-ma2-addition-probe.bas).
LIST matches the checked-in source, and two final runs produced the same
[result body](rsts-v4a-ma2-addition-output.txt), normalized to LF with trailing
ASCII spaces removed. Its source SHA-256 is
`9bc5fc4d4110e532f5bf56e984aaa610e495b840cae6715901d5f78416b52f3f`; result-body SHA-256 is
`3403e9b84c44ac73fd77832136266fb5c6835b8564d758178f97d2580f891a1b`.

The first overflow's nonzero continuation is repeatable. Adding these stored
lines to that probe and running again printed `ADD_OVERFLOWTRAPPED 48  11`,
confirming the error number/location independently of the manual table:

```bas
6 ON ERROR GOTO 9100
9100 PRINT "TRAPPED";ERR;ERL
9110 RESUME 8999
```

No trapped numeric continuation is inferred from RESUME to END. Restoring the
older saved guest state and entering NEW also reproduced the existing PC000056
halt, so the BASIC acceptance above uses a fresh boot, not restored-state I/O.
Startup/filesystem limitations from the build record remain open.
