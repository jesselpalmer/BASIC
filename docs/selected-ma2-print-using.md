# Selected MA2 PRINT USING integer images

The internal selected candidate now executes source programs beyond the reviewed
1CHECK image. The October 1972 [BASIC-PLUS Language Manual](https://www.bitsavers.org/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
section 10.4.1, describes numeric `#` fields, right justification, printable
image literals, percent markers when a field is too narrow, and a terminal
semicolon that keeps the cursor on the current line. For example, this selected
program prints `ROW:  17 | -4!` followed by a newline:

```basic
10 B$="ROW: ### | ##"
20 A=17
30 PRINT USING B$,A,-4;
40 PRINT "!"
50 END
```

The selected image is still one earlier literal assignment to `B$`, with no
other write to that variable. Admission checks the entire source before output:
the image must have one through 72 characters, one to six consecutive `#` per
numeric field, one value per field, and only ASCII letters, digits, blanks,
colon, semicolon, equals, slash, vertical bar, parentheses or question mark in
literal positions. The field widths follow the manual's six significant digits
for the two-word math package. The selected formatter consumes signed 16-bit
integers exactly. It right-justifies values within their fields; an overflow
prints `%` and the full signed integer, with a space before a positive value.
The 72-column terminal layout checks the completed text before a host write, so
an overflow that reaches the margin rejects that entire PRINT atomically.

Fractional values, decimal images, string fields, asterisk/dollar/comma masks,
exponents, image reuse, dynamic image assignments, and device output remain
outside this selected policy. Unsupported images reject at source admission
before any program effects. A dynamic unsupported value rejects its complete
PRINT before the cursor or host output advances. Earlier successful statements
retain their effects. The public native parser/runtime continue to use their
own documented bounded PRINT USING contract. This internal improvement alone
does not activate the selected public profile or certify the full game corpus.
