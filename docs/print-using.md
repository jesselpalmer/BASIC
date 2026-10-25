# Native integer PRINT USING

**Status:** implemented native slice for #120; its design was recorded before code.
Historical profiles and the remaining formatting forms stay open.

The separately corrected 1CHECK fixture executes its scripted native path,
including illegal/legal moves, retry, replay and normal exit. Its unformatted
numeric spacing remains native, and its original dialect is not certified; this
is not a complete historical-game compatibility pass.

## Evidence and scope

[BASIC-PLUS October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
§10.4.1 documents a string expression followed by a comma and a value list,
numeric `#` fields, right alignment and a final semicolon suppressing newline.
The inspected 1CHECK book listing has the comma after B$; the pinned repository
has a semicolon there. Raw and reviewed corrected listings remain separate.

The manuals disagree on fractional values, overflow and repeated images. This
native slice accepts only unambiguous integer fields with exactly one value per
field in one pass. It does not select a historical profile or guess the remaining
rules. See the existing source review for manual/scan provenance.

## Grammar and native preservation

`PRINT USING template, value [, value ...] [;]` creates a distinct formatted
statement. The template is an ordinary complete string expression; values use
the existing expression grammar and require commas. No omitted value separator,
trailing comma, file/channel syntax or template-semicolon alias is introduced.

USING remains an ordinary identifier. Select formatted grammar only when USING
is the first token after PRINT and a comma occurs at parenthesis depth zero
before the statement ends. String tokens and commas inside arrays/calls/groups
do not count. This accepts new syntax that ordinary native PRINT rejects while
preserving `PRINT USING`, `PRINT USING+1`, `PRINT USING(1,2)`, and string-involved
adjacent items such as `PRINT USING B$;J`. The latter remains ordinary output,
not a formatted semicolon alias. `PRINT USING("##"),1` explicitly selects a
grouped template; `PRINT USING(1)` remains array access. No keyword reservation,
whitespace-sensitive reinterpretation, speculative parsing or source rewrite.

## Fields, limits and execution

- Each maximal nonempty run of `#` is one integer field. Its width includes a
  negative sign; other positions are leading spaces. Zero and negative zero
  print as `0`. Values must be finite safe integers. Fractions/unsafe values,
  overflow, repeated/partial image use and unsupported masks fail explicitly.
- Require exactly one numeric value per field and at least one field/value.
  Complete one pass through the template, retaining prefix, inter-field and
  trailing literals exactly. No rounding, precision or overflow-marker policy is
  claimed by this slice.
- Literals are printable ASCII excluding formatting controls `.`, `,`, `+`, `-`,
  `*`, `$`, `^`, `!`, `\`, `'`, `_`, `&`, and `%`. Reject those controls anywhere,
  as well as control/non-ASCII characters. No literal-escape syntax is invented.
  Ordinary unformatted PRINT retains all its existing Unicode/text behavior.
- Cap the template at 4096 UTF-16 units and the value list at 4096 entries. A
  successful output has exactly the template's length, plus at most one newline;
  bounded width/count validation precedes padding or output allocation.
- Evaluate the template expression, then value expressions left to right,
  before formatting and one host write. A failing statement writes nothing;
  consumed random/key effects are not rolled back. Formatter failures point at
  the template expression and identify the offending value where applicable.
  Host failures retain existing HOST_ERROR/cause/reentrancy behavior.
- The formatted statement is one instruction for stepping, budgets and gates.
  Existing source locations, immutable snapshots, fresh reruns and cancellation
  between statements remain unchanged. This extends provisional closed AST
  unions before the 1.0 freeze.

## Verification and remaining work

`PrintUsingStatement` carries `format`, `items`, `separators` (actual template/value
commas and optional terminal semicolon), and `trailingSemicolon`. Ordinary PRINT
retains its existing AST. Whole-program validation rejects a statically numeric
template or an oversized item list before effects; dynamic formatting errors
come from the bounded core formatter.

Use independent expected strings for all eight 1..64 numbering rows, field/sign
boundaries, literal preservation, safe integer extremes, exact caps, rejection
paths, expression effects and a single atomic write. Verify old USING names and
arrays, malformed syntax, source spans and runtime recovery. Exercise direct and
installed ESM/CommonJS/types/CLI and actual browser/static artifacts on Linux/macOS.

Historical numeric spacing/zones/TAB, fractional/currency/exponent/string fields,
image reuse/partial lists, overflow conventions and full profile certification
remain #119/#120 work. Native numbering support alone is not a raw/corrected
whole-game compatibility pass or a READY release decision.
