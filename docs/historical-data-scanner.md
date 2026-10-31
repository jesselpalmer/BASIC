# Internal BASIC-PLUS DATA source mode

Design for #122/#117, recorded before implementation. Only the internal October
1972 lexical policy gains DATA mode. Public profiles, parser options, ASTs,
typed native DATA and runtime READ behavior remain unchanged.

## Primary evidence

Visually inspected the October 1972 [BASIC-PLUS manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
SHA-256 `684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Section 3.3.1, printed 3-4/3-5 (one-based PDF 31/32), defines comma-separated
DATA, requires DATA to finish its line and forbids trailing comments. Section
5.3, printed 5-8/5-9 (PDF 74/75), establishes the ASCII text pool, conversion
when READ chooses a target, single/double quoted values, and ignoring leading,
embedded and trailing spaces in unquoted values. Section 3.1, printed 3-2
(PDF 29), explicitly allows an exclamation mark as part of a DATA item.

## Closed scanner contract

In the existing shared scanner, accept DATA only at a historical statement
start and consume its remaining physical line as a nonempty comma list. Each
field emits an existing STRING token: even `0017`, `1E-3`, `%` or `A+1` remains
text, with no numeric conversion, expression parsing, evaluation or inference.
That token shape does not grant historical AST/runtime acceptance.

Double or single quoted fields preserve every character between their matching
delimiters, including ASCII spaces, commas, colons, apparent keywords and the
other quote character. Adjacent matching quotes are not guessed as escapes.
Empty quoted strings are retained as explicit string items. After a quoted
field, only ASCII spaces, comma or line end may follow. Unquoted fields remove
ASCII space U+0020 only; raw spelling and physical UTF-16 spans remain exact.
Unquoted empty/blank-only fields, omitted fields and trailing commas fail.

The first implementation accepts printable ASCII payloads only. Embedded tabs,
control/high-bit/Unicode source characters are explicitly unsupported rather
than trimmed, normalized or encoded. Unquoted quotes, colons and backslashes
are also explicitly unsupported until their ambiguous delimiter/continuation
rules are settled. Quoted versions remain text. `!` is literal DATA text, never
a comment marker, and REM/THEN/ELSE/function-like text inside a field stays text.
LF/CRLF end the DATA mode without joining physical lines; bare CR is unsupported.

Cap each DATA list at 4096 fields, decoded field length at 32767 characters, and
the complete raw physical payload at 262144 UTF-16 units. These are deliberate
implementation limits, not historical storage limits. Check the payload cap
before tokenizing fields, field count before beginning an extra field, and
decoded length before appending more characters. All scans progress monotonically
with no repeated suffix search. Failure returns no token stream or host effects.

Verify original manual examples, protected literals, compact preceding statements,
every raw span, fragment offsets/tabs/CRLF boundaries, malformed lists/quotes,
explicit unsupported forms, exact caps, long inputs, native token/AST behavior,
public rejection, independent scans and recovery. The full quality/package gate
and Linux/macOS browser/archive validation remain required. Historical READ
conversion, data-pool preparation, continuation, profile activation and the full
108-file behavior gate remain open; #109 remains NOT READY.
