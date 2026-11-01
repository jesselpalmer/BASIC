# Native PRINT USING trailing minus

Design before code for #120. Extend an integer or asterisk field with one
immediately following `-`. That final position prints `-` for a negative value
and ASCII space for a nonnegative value, including negative zero. Digits contain
the magnitude, right-aligned in the preceding positions. The suffix adds one
column; it never increases digit capacity. Asterisk fields retain their two
extra digit positions and may now format negative safe integers with this suffix.

Primary evidence is the October 1972 BASIC-PLUS manual §10.4.1, printed 10-10
(PDF 149), visually reviewed from SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Its preceding printed page 10-9 requires a trailing sign for negative asterisk
fields. The manual's fractional example establishes sign placement, not native
decimal rounding: fractions, currency and exponential formatting stay unsupported.

Examples: `###-` formats -12 as ` 12-` and 12 as ` 12 `; `**#-` formats -12 as
`*12-` and 12 as `*12 `. A value needing more digit positions fails with the
existing FORMAT_OVERFLOW. A lone, leading, repeated or space-separated minus is
not a field. Existing images remain unchanged, including ordinary signed integer
fields and the rejection of negative asterisk values without a suffix.

Keep exact value counts, typed mixed fields, image/value limits of 4096, output
equal to image length, left-to-right evaluation, source locations and one atomic
host write. No parser, AST, evaluator or host capability change is needed.
Verify exact sign/padding at zero and safe-integer extremes, field boundaries,
malformed images, mixed fields, runtime errors/Step/recovery and actual installed
library/CLI/editor/browser/extracted-archive behavior.
