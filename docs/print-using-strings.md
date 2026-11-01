# Native PRINT USING string fields

Design before code for #120. Extend the existing formatter without changing
parser/runtime/AST ownership. Existing valid integer images and USING names
retain their meaning; the new field markers were previously rejected controls.

The October1972 BASIC-PLUS manual §10.4.1, printed10-7/10-8 (PDF146/147), was
rendered from SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
It specifies `!` as a one-character string field and a pair of backslashes with
only spaces between them as a wider field; width includes both backslashes.
Its examples print ACE from AB/CD/EF with three bangs, and ABEFGH from ABCD/EFGHI
using widths2 and4. No image cycling or fractional/numeric policy is imported.

Each `!` consumes one string value and emits its first byte character. Each
backslash pair consumes one string and emits up to its width. Native right-pads
short/empty strings with ASCII blanks so output remains exactly image.length;
this padding policy is explicit rather than inferred from the long-string
manual examples. Only emitted prefixes must be code units0..255; unused tails
are ignored. Ordinary unformatted Unicode output remains unchanged. Strings
are not converted to numbers and numbers are not converted to string fields.

Keep maximal # runs, right-aligned safe integers, strict overflow and one pass
with exactly one value per field. Mixed fields consume values in image order.
Unmatched backslashes or non-space field interiors fail as unsupported formats.
Other reserved controls remain rejected, including variable-width &, numeric
rounding/currency/exponents, escapes and image reuse. Existing image/value caps
remain4096. Validate at most each field's emitted width, keeping total string
traversal/output bounded by image length even for large source strings.

The runtime still evaluates image then every value left to right before one
atomic host write. Invalid later fields produce no partial output; consumed
host effects are not rolled back. Error locations stay at the image. Verify
manual outputs, short/empty padding, mixed types/order, high/control bytes,
Unicode prefix rejection/ignored tails, exact caps, malformed images, effects,
native regression images and direct/installed CLI/browser/archive behavior.
