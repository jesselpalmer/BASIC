# Selected integer conversion-string codec

Design before code for #59/#124. Complement the internal MA2 codec without
changing its owner or adding evaluator intrinsics/public profiles.

The October1972 manual §11.5/table11-2, printed11-9/PDF162, was rendered and
reviewed from SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
It maps an integer to two characters, maps the first two characters back to an
integer, and null-pads a shorter input. The selected V4A reference probe's
CVT%$(1%) observation is `[0,1]`; the stored integer format is signed16-bit
two's complement. Use high byte first, matching that selected-build evidence,
rather than host memory order or the MA2 floating word permutation.

Encode an already validated signed word -32768..32767 as exactly two code units
0..255. Decode a byte string's first two characters to its signed word, appending
null bytes when short. Enforce the existing32767-byte string domain and validate
all characters, including an unused suffix. Return a number/string primitive;
retain no caller data. Malformed host types throw TypeError; nonfinite,
fractional/out-of-range numbers, non-byte characters and excessive strings throw
RangeError. No numeric argument truncation or error51 policy is inferred.

Use explicit signed endpoint/byte-pair expectations, each bit position and all
65536 signed words against independent byte arithmetic. Test null padding,
prefix consumption, controls/high bits, exact limits and malformed inputs.
Keep both codecs separate from raw numeric decoding and source-level CVT
evaluation. CI consumes existing offline evidence, with no emulator/OS download.
