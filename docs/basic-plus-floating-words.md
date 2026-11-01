# Exact BASIC-PLUS floating-word decoding

**Status:** internal representation prerequisite for #123/#116. This does not
activate a historical profile, perform arithmetic, or convert BASIC literals.

## Evidence and word order

The primary source is Appendix F.1, printed F-1/F-2 (one-based PDF 225/226), of
the [October 1972 BASIC-PLUS manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf).
Both pages were rendered and visually reviewed from the 237-page scan with SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
The [numeric contract](numeric-representation.md) records the broader limitations.

Each input word is an unsigned 16-bit pattern, in increasing address order:
`word`, `word+2`, then (for four-word format) `word+4`, `word+6`. This is a word
codec, not a byte codec; no host byte endianness is involved. The first word has
sign in bit 15, an eight-bit excess-128 exponent in bits 14 through 7, and seven
high fraction bits in bits 6 through 0. Successive words continue the fraction
from most to least significant. The binary radix point precedes the hidden bit.

The manual's independent octal examples are:

| Value | Two-word patterns | Four-word patterns            |
| ----- | ----------------- | ----------------------------- |
| +1    | `040200 000000`   | `040200 000000 000000 000000` |
| -5    | `140640 000000`   | `140640 000000 000000 000000` |

For nonzero exponent fields the hidden bit is one, yielding 24 or 56 significant
bits. The exact mathematical value is
`sign * significand * 2^binaryExponent`, with a positive BigInt significand and
`binaryExponent = storedExponent - 128 - precision`. No intermediate passes
through a JavaScript number. The number-valued fields are bounded small integers.

F-2 explicitly represents zero by two or four zero words and says the hidden bit
is zero for exponent field zero. It does not settle the meaning of other patterns
with that exponent field. Canonical all-zero input therefore decodes to positive
zero (`sign = 1`, `significand = 0n`, `binaryExponent = 0`). A set sign with no
fraction returns `unsupported: signed-zero`; any nonzero fraction with exponent
zero returns `unsupported: zero-exponent-fraction`, regardless of sign. These are
evidence boundaries, not assertions that the hardware reserves these patterns.

All nonzero exponent fields, including 1 and 255, decode as documented bit
representations. That does not claim that BASIC literals or arithmetic can
produce every such pattern or establish overflow/underflow thresholds. IEEE
infinities, NaNs and subnormals are not imported into this format.

## Ownership and validation

`src/core/basic_plus_floating_words.ts` owns a single pure decoder. It accepts an
actual array of exactly two or four numeric integer words in `0..65535`; signed
integer words, typed arrays, byte buffers, other lengths and coercible objects
are rejected. Malformed containers raise TypeError and malformed lengths/words
raise RangeError. Unsupported historical encodings return frozen discriminated
outcomes rather than silently producing native values.

The decoder reads length once, rejects excessive lengths before reading payload,
and reads each indexed word once into a bounded private snapshot. It never uses
the caller's iterator. Accessor/proxy exceptions propagate without partial
results; callbacks cannot increase work beyond four payload reads. Results and
their exact descriptors are frozen and retain no caller-owned array.

This descriptor is an internal exact mathematical observation, not BasicValue or
a new public numeric type. There is no encoder in this slice: choosing a word
pattern for a literal or arithmetic result requires separate decisions about
rounding, signed zero, supported range and continued numeric errors. There is no
native fallback, Math.fround, registry, mutable precision option, or public export.

## Acceptance

Tests use the manual's octal examples, independent power-of-two/integer oracles,
each stored fraction bit and word position, exponent endpoints and sign changes.
Four-word cases preserve `2^53 + 1` and `2^55 + 1` exactly, and distinguish
adjacent 56-bit significands; two-word cases retain 24 significant bits. Zero and
unresolved exponent-zero patterns, invalid words/containers, sparse/excessive
arrays, hostile iterators, changing getters, and result immutability are covered.
The full repository gate verifies the existing native/public package contract.

The separate [MA2 addition/subtraction component](basic-plus-ma2-addition.md)
uses this decoder for canonical 24-bit operands and returns exact word results
or explicit unsupported/range outcomes. It does not provide general literal
encoding, four-word arithmetic or public historical activation.
