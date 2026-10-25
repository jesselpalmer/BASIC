# Native PRINT item adjacency

Native `PRINT` accepts an omitted semicolon between two complete expressions
when at least one of the neighboring expressions has an inferred string result.
This is a deliberately limited native grammar extension for #119. It does not
select or certify a historical dialect.

The [BASIC-PLUS October 1972 manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
section 3.3.2, printed pages 3-8–3-9, documents omitting the semicolon between
text and another PRINT item. The [source review](classic-source-review.md)
records the manual provenance and the adjacent text/number forms in 1CHECK.
This native slice preserves native output spelling; historical number padding,
comma zones and TAB remain separate work. [Native integer PRINT USING](print-using.md)
has its own explicitly bounded contract.

## Item boundaries

The parser first consumes the existing complete expression, including all of
its operators, groups, calls and array subscripts. A following number, quoted
string, identifier, built-in function or opening parenthesis can start another
item. The omitted separator is valid only when either neighboring expression
infers string: a string literal, a `$` variable or array, `INKEY$()`, a group of
a string expression, or string concatenation. Mixed-type `+` expressions do not
infer string. Each boundary is checked independently.

| Source                | Native meaning                                              |
| --------------------- | ----------------------------------------------------------- |
| `PRINT "SCORE=" N`    | Two items, concatenated without extra spaces.               |
| `PRINT N" points"`    | Two items; whitespace is optional at this token boundary.   |
| `PRINT (NAME$+"=") N` | A string group followed by a numeric item.                  |
| `PRINT 1 2`           | Error: two numeric items require a semicolon.               |
| `PRINT "x" (1)(2)`    | Error at the final group: that neighboring pair is numeric. |
| `PRINT 1 -2`          | One subtraction expression, as before.                      |
| `PRINT 1; -2`         | Two items, with an explicit semicolon.                      |
| `PRINT A (1)`         | One array reference, regardless of whitespace.              |
| `PRINT "x" A(1,2)`    | A string followed by one two-dimensional array reference.   |
| `PRINT USING B$;J`    | Ordinary variables USING, B$ and J; USING remains a name.   |

Semicolons can separate any expressions and a final semicolon suppresses the
newline. A PRINT without items still emits a newline. Empty items, comma-based
output, comparisons and malformed expressions remain errors. Adjacency is only
a PRINT-list rule: `(1 2)`, `ABS(1 2)` and `A(1 2)` remain malformed, as do
adjacent expressions in assignments and other statements.

Tokenization is unchanged. Long native names are not split, numeric-looking
words such as `12oops` remain invalid, and doubled quotes inside a quoted string
remain escapes rather than two adjacent literals. No source is rewritten.

## AST and execution

`PrintStatement.items` retains expressions in source order. `separators` contains
only the locations of semicolons actually present in the source, including a
trailing semicolon. It has no entry for an omitted separator; consumers must not
assume one entry per item boundary. `trailingSemicolon` is true only for a real
final semicolon. All expression, separator and statement locations retain the
physical UTF-16 offsets, lines and columns, including fragment origins.

Execution uses the existing native PRINT behavior: evaluate each item in order,
concatenate its native string value, and add a newline unless suppressed by the
trailing semicolon. Native number spelling and host effects are unchanged.
Whole-program array declaration/rank checks still inspect every item, including
unreachable lines.
