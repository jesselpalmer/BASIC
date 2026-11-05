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
even when later conversion can produce equal numeric values. The descriptor is immutable and
retains the complete raw text. Unsuffixed whole spelling is not a claim of
integer runtime kind: mixed-mode interpretation still needs grammar evidence.
Historical scanner tokens now use RAW_NUMBER with null values and exact raw
text. Later consumers recover lexical kind from the spelling rather than infer
it from a JavaScript value. The public Token union gains this explicit case;
native tokens and all AST shapes remain unchanged.

Only short variable names and digit literals gain `%`. Intrinsic result suffixes
and user function syntax need their separately reviewed contracts. Intrinsic-like
suffixes must fail before matching a supported prefix. Strings/comments retain
literal percent text. Compact FOR/THEN/ELSE boundaries and physical UTF-16 spans
must remain intact. Native suffix rejection and maximal name/number scanning
must remain unchanged.

Require focused token, descriptor, malformed suffix, boundary, location, native
regression and public rejection tests, followed by the full quality/package gate.
Keep historical execution, source certification and the 108-game gate open.

## Raw token follow-up

The [raw numeric stage](historical-raw-numbers.md) removes the old decoded
host-number payload from historical spelling descriptors and scanner tokens.
Integer range checks compare normalized digit strings exactly; suffix spellings
and raw/physical locations remain intact. Public native NUMBER tokens and
unsupported historical integer execution remain unchanged.
