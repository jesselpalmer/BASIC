# Internal BASIC-PLUS string conformance

Design for #59/#116, recorded before implementation. Public dialects, intrinsics,
native names, and native string behavior are unchanged. This pure helper layer
prepares later shared evaluator integration; it does not activate a profile.

## Primary evidence

Visually inspected the October 1972 [BASIC-PLUS manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
SHA-256 `684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Printed 5-6 (PDF page 72, one-based) is table 5-2; printed 5-13/5-14
(PDF pages 79/80) are table 5-3. Those pages establish the following subset:

| Operation | Settled behavior |
| --- | --- |
| LEN | Counts every character, including trailing blanks. |
| LEFT | Returns the first N characters. |
| RIGHT | Returns characters starting at position N through the end. |
| MID | Returns N2 characters starting at position N1. |
| ASCII | Returns the code of the first character. |
| CHR$ | Returns one character for its code. |
| SPACE$ | Returns N blanks. |
| INSTR | Searches from position N1 and returns the one-based match position, or zero. |

Table 5-2 lists ASCII 0..127 and explicitly permits character values 128..255
inside strings. High-bit characters are distinct in comparisons even when a
terminal renders them alike. Represent each byte as one JavaScript code unit
0..255 inside these helpers; do not encode UTF-8, strip high bits, normalize text,
interpret terminal controls, or count Unicode code points.

## Closed implementation boundary

All accepted strings contain only code units 0..255 and have at most 32767
characters. The length cap is a deliberate implementation resource limit, not a
historical storage rule: §5.1.4 says storage availability limits string length.
It also keeps LEN results inside the signed word range. Check length before
traversing input and check all characters before producing any value.

Substring positions/counts must be positive integers, within the source, with
the full requested substring in bounds. SPACE$ accepts integer counts 0..32767;
CHR$ accepts integer codes 0..255. Empty ASCII input and empty INSTR patterns are
explicitly unsupported. Empty LEN and zero-space generation are supported.
Do not infer behavior for zero/negative/fractional/out-of-range substring inputs,
index conversion, empty-pattern search or empty-string special cases from later
BASIC revisions or JavaScript slice/indexOf. Those remain separate evidence and
continued-error work. Numeric VAL/NUM$, CHANGE, comparisons, function resolution,
evaluation order, and public AST/runtime integration remain open.

Pure helpers return immutable `{kind: 'value', value}` or
`{kind: 'unsupported', reason}` results. Malformed host argument types throw
TypeError rather than coerce. Helpers perform no host calls, input writes,
mutation, statement advancement or runtime effects. Future integration must
translate unsupported outcomes into source-located preflight/runtime policies.

## Verification

Use the manual alphabet examples: LEFT at 7 gives ABCDEFG, RIGHT at 20 gives
TUVWXYZ, MID at 15/count 5 gives OPQRS, LEN gives 26, ASCII of XAB gives 88,
CHR$ of 65 gives A, and INSTR from 5 searching OP gives 15. Test every byte,
all in-bounds positions on an independently authored short string, trailing
blanks, controls/high bits, exact limits, invalid types, unsupported edges,
immutable outcomes, independent calls, native names and native string errors.
Require the full quality/package gate and Linux/macOS browser/archive checks.
Passing these helpers certifies no complete corpus game; #109 stays NOT READY.
