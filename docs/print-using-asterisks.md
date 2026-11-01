# Native PRINT USING asterisk fill

Design before code for #120. Extend the existing bounded formatter with
`**` followed by one or more `#` characters. The two asterisks count as two
additional digit positions; unused leading positions contain asterisks.

The October 1972 BASIC-PLUS manual §10.4.1, printed 10-9 (PDF 148), establishes
the two additional positions and asterisk fill. The rendered primary scan has
SHA-256 `684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Its fractional example uses `**###.##`; decimals remain outside this native
integer slice. The same page forbids negative values unless a trailing sign is
selected. Native does not yet implement trailing signs, so negative values in
asterisk fields fail explicitly. Negative zero prints as zero.

Accept only nonnegative safe integers, retain strict field overflow and exact
value counts, and require at least one `#` after the prefix. A bare `**`, a lone
asterisk, a third prefix asterisk and an asterisk after a `#` run are unsupported.
Do not change ordinary integer fields, string fields, literal images, expression
order, atomic output or limits. Mixed fields consume values in image order and
successful output stays exactly the image length. This native extension does
not enable historical numeric rounding, currency, signs, overflow markers or
image reuse.

Verify independently expected padding at zero, exact fits and safe-integer
boundaries; malformed controls, negative/fractional/overflow values, mixed
fields, resource bounds, runtime effects/locations/Step/recovery and installed
library/CLI/browser/archive behavior. The formatter remains the sole owner of
this rule; no AST, parser or evaluator change is needed.
