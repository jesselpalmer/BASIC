# Bounded BASIC-PLUS string values and relation binding

Design before implementation for #59/#116/#124. Extend the existing byte-string
owner with pure concatenation and bind its established padded relation results
through the shared comparison owner. No additional parser, evaluator or public
profile is created. Native concatenation, exact equality and ordered-string
rejection stay intact.

The October 1972 BASIC-PLUS manual §5.1.4 (printed 5-3/5-4; one-based PDF 69/70)
uses + to append string expressions, retaining their characters and blanks.
Section 5.1.5/table 5-1 (printed 5-4/5-5; PDF 70/71) supplies padded comparison;
table 5-2 explicitly distinguishes high-bit character values. Use the same
[primary manual and byte contract](string-conformance.md) already pinned by hash.
These are manual-backed conformance facts, not new selected-machine captures.

Concatenation validates both complete primitive string operands, including empty
operands, against the existing code-unit 0..255 boundary. Validate input length
before scanning bytes; after both boundaries pass, reject combined length above
32767 before allocating the result. Preserve NUL, all high bits, case, leading,
embedded and trailing blanks exactly. The cap is an implementation resource
limit, not a historical storage/error rule. Unsupported results remain frozen;
malformed types throw without coercion or calling hostile conversion hooks.

The comparison adapter returns a frozen boolean for the existing helper's -1/0
logical word, propagating unsupported reasons unchanged. Reuse its complete
byte validation, ASCII-blank padding and restricted A..Z/blank ordering domain;
do not broaden collation or change logical-word expression representation.
It does not evaluate operands, choose a source location, execute IF, or settle
string INPUT, defaults, storage, allocation failure or continuable BASIC events.

Verify manual concatenation examples, every byte in either position, empty and
blank operands, exact/over-limit combined lengths, invalid tails after an early
difference, malformed/hostile types, all six relations across independent
alphabet/padding expectations, composition and immutable results. Direct and
installed/browser consumers keep the helpers private and native Unicode/string
behavior intact. Full Linux/macOS, Chromium and exact archive checks are required;
no corpus game or historical execution profile is certified and #109 is NOT READY.
