# Internal BASIC-PLUS PRINT layout conformance

Design for #119/#116, recorded before implementation. This pure internal layer
does not activate a historical profile, add public PRINT syntax, or alter native
output. It handles settled layout operations after expression evaluation.

## Primary scan evidence

Visually checked §3.3.2, printed pages 3-6 through 3-9 (one-based PDF pages
33 through 36) of the October 1972 [BASIC-PLUS manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
SHA-256 `684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.

| Location | Settled rule |
| --- | --- |
| 3-6 | A number has a leading sign position (blank or minus) and a trailing blank. Bare PRINT ends a line. |
| 3-7 | A 72-character terminal has five zones of 14 columns. A comma advances to the next available zone; the sixth entry begins a new line. Consecutive commas skip zones. |
| 3-7/3-9 | A final comma suppresses the statement's final newline and leaves subsequent output in the next zone. |
| 3-8 | Semicolons add no separator spaces. A comma moves at least one column, possibly onto a new line. Strings receive no added leading or trailing blanks. |
| 3-9 | A final semicolon also suppresses the statement's final newline. |

The manual notes more zones on terminals wider than 83 columns. This first
conformance layer deliberately selects the documented 72-column configuration;
it does not infer terminal width from the host. Its zone starts are zero-based
columns 0, 14, 28, 42 and 56. Its cursor is the column of the next character,
0..72 inclusive. A comma always advances beyond the current cursor: a cursor
already at column 14 advances to 28. A comma beyond the fifth zone emits one
logical newline and sets the cursor to zero. Logical newlines use `\n`; eventual
host adapters own terminal CR/LF encoding.

## Closed implementation subset

Use decoded operations for printable ASCII strings, already-selected signed-word
integers, comma and semicolon. This is not an AST or another source parser.
Integers must be in -32768..32767; floats, nonfinite values, controls, high-bit
characters, Unicode and terminal movement sequences remain unsupported. Integer
zero has no negative-zero encoding. Numeric output therefore needs no unresolved
floating representation or decimal precision rule.

The operation list permits consecutive separators so the manual's skipped-zone
behavior can be checked. It does not authorize arbitrary separator grammar in a
public program. A text/integer operation must fit entirely within the remaining
72-character line. Automatic text/number wrapping and splitting at the margin
remain unsupported until their exact terminal rules are settled. Comma-induced
line changes are supported. A final ordinary item or an empty list emits one
newline; a final separator suppresses that extra newline.

Allow at most 4096 operations and 65536 output characters per call, checking
sizes before padding/output allocation. Return a frozen completed text/cursor
pair or an explicit frozen unsupported outcome, with no partial text. Malformed
host argument types/operators throw TypeError and an invalid initial cursor
throws RangeError. Input operations are not mutated or retained. No Host call,
runtime state, instruction, Step or asynchronous ownership is introduced.

## Verification and remaining integration

Independently assert the manual's `3,2,5,6,1,-1` five-zone wrap and `1,2,,3`
skipped-zone examples. Check semicolon packing, trailing separators across calls,
bare PRINT, empty text, signs/zero/endpoints, exact zone boundaries, fifth-zone
transition, cursor validation and atomic margin/resource failures. Assert native
compact numeric output, existing names and native comma rejection remain intact.
Run the full quality/package gate plus Linux/macOS browser/archive validation.

TAB, arbitrary terminal widths, floating output, terminal controls, profile
activation, parser/evaluator integration, PRINT USING and complete game outcomes
remain separate work. Passing this helper closes no historical game or release
gate; #109 remains NOT READY.
