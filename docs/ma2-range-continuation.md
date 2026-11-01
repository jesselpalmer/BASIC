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
status data. Both range entries carry the same inline mask, octal100002.

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

Preserve the first range reason/code48 and attach separately named, frozen
continuationWords. Retain the mask and machine-trap counts in captured research
data, not in the runtime result API. They are not separate host callbacks, a
count of printed diagnostics, or a policy for BASIC handlers/RESUME. Keep range
outcomes distinct from successful values. Unsupported inputs and existing normal results
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

## Captured completion records

The [offline fixture](../src/core/__tests__/ma2-range-reference.json) records118
completed range/control cases. Its598 independently executed calls recheck the
original496 inputs through the real monitor handler and add102 distinct boundary
inputs. All480 original normal results match unchanged. Of the598 calls,495
complete normally,78 first reach overflow and25 first reach underflow. There are
95 one-trap and8 two-trap calls. Retained rows contain all103 range results plus
15 new normal controls; the old480 normal rows remain in the original fixture.

Use the same pinned loader and simulator as the original capture. Configure only
the data word at octal4064 to point at scratch140010, cleared before each call.
The selected BASIC task uses006042; the standalone harness needs its own latch.
Leave instructions, vector034 (060404), PSW vector036 (zero) and handler intact.
Break only at normal return100732, not at a range entry. For example, this
maximum-plus-maximum call completes with words000377/177777 and latch100002:

```text
set cpu 11/05
set cpu 64K
load generated/SY2.LDA
dep 4064 140010
break 100732
set cpu history=1000
dep 140010 0
dep 140000 077777
dep 140002 177777
dep 140004 077777
dep 140006 177777
dep r1 140000
dep sp 150000
dep psw 0
dep pc 100332
step 10000
ex 140004
ex 140006
ex 140010
show cpu history
```

Reset history (`set cpu history=0`, then1000), operands, latch and registers for
each case. SUBF starts at100326. Read the three scratch words separately; SIMH's
range examination can compress repeated zeros. Derive the first range reason
and trap count from instruction-history PCs100742/101026, not the final latch.
The longest captured history has210 entries, below the1000-entry buffer; every
call reaches the normal breakpoint before the10000-instruction bound. The raw
capture SHA-256 is retained in fixture metadata; CI needs no historical binary.

To reproduce the additional input selection, use canonical `w(e,f,s)` words
`[s*32768+e*128+(f>>16), f&65535]`, where `s` is0/1. Keep original inputs first,
deduplicate exact left/operator/right tuples, then select:

- Both fractions from `{0,1,0x7fffff}` at exponent255, both signs and operations,
  with right sign `s XOR operation` (operation0 add/1 subtract).
- Left exponent255/fraction0x7fffff; right exponent255 minus each gap in
  `{1,8,16,23,24,25}`, fraction0/0x7fffff, the same sign/operation combinations.
- Equal exponents `{1,2,12,23}`, left fraction1/65535, right fraction0,
  both signs/operations, with right sign `s XOR (1-operation)`.

## BASIC boundary cross-check

A fresh boot with the documented clock adjustment ran carry overflow, rounding
overflow and normalization underflow, stopping before each trap and at normal
return. Neither inline-word address100744/101030 was executed. The same monitor
handler ORs the masks and advances its saved PC at060672/060676. Each BASIC
statement printed one FLOATING POINT ERROR (lines11/21/31), including rounding
overflow's two machine traps. Signed `CVT$%` observations of the conversion
string were `-1 255`, `0 0`, `0 0`, matching the earlier six-case byte probes.
These conversion-string halves are not memory-word order; maximum addition's
completed memory words are `[255,65535]`. The earlier separate ERR/ERL probe
establishes error48, but this trace does not settle expression unwinding,
diagnostic timing, handler transfer or RESUME state for public execution.
