# Selected MA2 range continuation

Design/evidence before implementation for #123/#128. This extends the internal
pinned MA2 component, without enabling a historical profile or diagnostic/trap
control flow.

## Trace boundary

The selected build and code hashes remain those in
[MA2 addition/subtraction](basic-plus-ma2-addition.md). The trace distinguishes
machine TRAP0 handling from BASIC's eventual error48 dispatch. At octal060672,
the monitor ORs the inline word at the saved PC into the selected status latch,
advances that PC by two bytes and restores registers/PSW. It does not execute
the inline word as an instruction. The disassembled BPL after TRAP0 is therefore
status data. The overflow mask is octal100003; the underflow mask is100002.

The arithmetic routine resumes after the mask, then completes its result before
returning to its caller. Diagnostic/handler timing beyond that machine-call
boundary remains execution-owned and must not be inferred from this helper.

## Continuation cases

- Carry overflow has already incremented exponent255 to256, then byte-swapped
  it before detecting the range event. The resumed path reuses that swapped
  value as exponent1. The normalized significand/sign survive, producing a
  small nonzero result rather than the manual's general zero continuation.
- Rounding overflow reaches the same overflow entry after packing has rolled
  the signed high word to zero or its sign bit. Resumption then reaches the
  underflow entry. The two masks are OR-latched, and the result becomes zero.
- Normalization underflow reaches its own entry directly and resumes with zero.

Preserve the first range reason/code48 and attach a separately named continuation
record: frozen result words, the combined status mask and ordered machine masks.
These are machine completion facts, not separate host callbacks, a count of
printed diagnostics, or a policy for BASIC handlers/RESUME. Keep range outcomes
distinct from successful values. Unsupported inputs and existing normal results
remain unchanged. Use one arithmetic owner rather than a second evaluator or a
separate copy of the addition algorithm.

## Acceptance

Capture canonical operands at all three entries, run the original routine to
its normal return with the real selected monitor's status-latch behavior, and
compare final words plus masks. Do not mistake trap scratch memory for results.
Use signed and reversed add/subtract cases, carry/rounding overflow, underflow,
endpoint neighbors and independent normal cases. Retain the original stop-at-trap
vectors and normal test gates. Verify actual BASIC continuations and one-vs-two
machine traps separately from ERR/message counts. No OS binaries are bundled;
normal CI consumes captured data offline.
