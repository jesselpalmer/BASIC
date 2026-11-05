# Raw historical numeric tokens

Design before implementation for #117/#116/#123. Implement the first scanner
stage of the [shared MA2 value contract](ma2-shared-value-contract.md) while
keeping public execution native-only.

The internal historical scanner emits a distinct `RAW_NUMBER` token whose
value is null and whose raw spelling/location remains exact. Labels retain their
bounded integer LABEL tokens. Native NUMBER tokens retain finite numeric values;
native source, ASTs, diagnostics and public parser options are unchanged.
The public closed Token union gains this explicit case so consumers can narrow
it safely, even though the historical scanner is not a package entrypoint.

Historical spelling classification returns only frozen raw/kind facts: integer
suffix, unsuffixed whole or floating notation. It must not compute a JavaScript
numeric value. Validate uppercase unsigned syntax, retain separate source signs,
and preserve the existing unsupported integer-suffix range through lexical digit
comparison after removing leading zeros. Valid decimal spellings beyond host
range/precision remain raw; conversion statuses and the source converter's input
limit belong to later preparation. A raw token never certifies a MA2 value or
an executable historical program.

Preserve compact clause boundaries, comments, quoted payloads, DATA text and
physical UTF-16 coordinates. Scanning/classification remains monotonic and linear;
no suffix-wide Number conversion, BigInt accumulation or repeated slicing loop
is needed. Keep keyword context and malformed suffix diagnostics intact.

Verify raw/kind facts and token spans across exact-decimal neighbors, long
mantissas/exponents, integer endpoints/leading zeros, signs, fragments and CRLF.
Use all396 original ATOF spellings to prove that scanner spelling reaches the
separate converter unchanged; the numeric result remains its independent
fixture's responsibility. Retain native NUMBER/AST comparisons, strict malformed
spelling and public context rejection. Check installed positive/negative Token
consumer types and the full Linux/macOS package/browser/archive gates.
