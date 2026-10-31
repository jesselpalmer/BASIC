# Internal integer token conformance

This #124/#117 prerequisite extends the internal October 1972 BASIC-PLUS scanner
using the already reviewed manual §2.5.2 and §6.1 evidence in
[integer semantics](integer-semantics.md). Public parsing and execution remain
native; historical AST integration and profile activation remain pending.

Recognize uppercase short names with one optional digit and one `%` suffix,
including array targets. Retain the suffix in the identifier value and raw span.
Recognize unsigned digit-only `%` literals through 32767. Signs remain separate
operator tokens. Fractional/exponent suffixes and repeated/mixed suffixes fail.
The magnitude 32768 (including the operand in `-32768%`) remains explicitly
unsupported until signed literal/AST treatment is settled; no wrap or truncation
is performed by scanning. Larger integer literals also fail explicitly.

An internal literal descriptor distinguishes explicit integer, unsuffixed whole
spelling, and floating spelling. `4`, `4%`, `4.`, and `4E0` must stay distinct
even when their decoded numeric values agree. The descriptor is immutable and
retains the complete raw text. Unsuffixed whole spelling is not a claim of
integer runtime kind: mixed-mode interpretation still needs grammar evidence.
Scanner tokens keep their existing NUMBER representation and exact raw text;
future historical AST preparation must use the descriptor rather than infer kind
from the JavaScript value. No public Token or AST shape changes in this slice.

Only short variable names and digit literals gain `%`. Intrinsic result suffixes
and user function syntax need their separately reviewed contracts. Intrinsic-like
suffixes must fail before matching a supported prefix. Strings/comments retain
literal percent text. Compact FOR/THEN/ELSE boundaries and physical UTF-16 spans
must remain intact. Native suffix rejection and maximal name/number scanning
must remain unchanged.

Require focused token, descriptor, malformed suffix, boundary, location, native
regression and public rejection tests, followed by the full quality/package gate.
Keep historical execution, source certification and the 108-game gate open.
