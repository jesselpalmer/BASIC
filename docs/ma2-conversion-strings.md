# Selected MA2 conversion-string codec

Design before implementation for #59/#123. This is an internal representation
codec for the pinned V4A-12 MA2 build, not an implementation of CVTF$/CVT$F
evaluation, literal conversion, numeric rounding or a public historical profile.

The October1972 manual §11.5/table11-2 (printed11-9/PDF162), rendered and reviewed
from scan SHA-256 `684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`, defines floating
representation/string conversion. AppendixF defines stored words in increasing
address order. The [selected build's independently repeated probe](rsts-v4a-build.md#authored-probe-and-captured-observations)
records four conversion-string bytes: +1 gives `[0,0,64,128]`, -5 gives
`[0,0,193,160]`. The independent AppendixF examples have words `[0x4080,0]`
and `[0xc1a0,0]`. The observed mapping emits the low fraction word first, then
the sign/exponent word, with the high byte first within each word. This differs
from native PDP-11 memory byte order. Keep the selected-build limitation; do not
generalize to MA4 or integer conversions.

Accept exactly two unsigned16-bit words in increasing-address order and encode
exactly four JavaScript code units in0..255. Decode the first four such code units
back into a frozen pair; the manual requires ignoring extra characters and
appending null bytes to a short string. These are raw representation mappings: preserve every
bit, including exponent-zero patterns, without assigning those patterns numeric
meaning. The existing floating-word decoder remains the semantic authority for
its supported mathematical observations; this codec must not bypass its explicit
unsupported outcomes or reinterpret raw patterns as native BASIC values.

Malformed containers/types throw TypeError; wrong word counts/ranges/non-byte
code units throw RangeError. Apply the existing32767-byte string limit and
validate the entire input string, including unused trailing characters, before
producing a result. Reject length before payload reads, read array
length and each index once, never call the input iterator, and retain no caller
buffer. No UTF-8 encoding, host-endian DataView or four-word mapping is inferred.
Source-level evaluation, numeric argument conversion and diagnostic behavior
remain separate work.

Use independently captured byte/word pairs and every individual bit/byte position
as primary expectations, then exhaustive one-word patterns in both positions and
raw exponent-zero/edge patterns. Round trips supplement these oracles rather
than replacing them. Test malformed/hostile inputs, bounded getters, exception
propagation, frozen detached words and offline package
checks. CI downloads no historical kit. Native arithmetic and source grammar
remain unchanged; #59/#123 and whole-game acceptance stay open.
