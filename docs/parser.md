# Parser API and program snapshots

The [language and session contract](language-v1.md) defines supported syntax.
This guide describes parsing boundaries, returned trees, and diagnostics.

The package exports `parseLine`, `parseProgram`, and `validateProgram`. They
consume source/parsed lines and return immutable data without executing BASIC,
reading files, opening a terminal, evaluating JavaScript, or retaining program
state between calls. The [evaluator API](evaluator.md) evaluates expression nodes
separately. The CLI and `Basic.run()` use these same parser/evaluator APIs through
the [statement runtime](interpreter-host.md).

```js
import {parseLine, parseProgram, validateProgram} from 'node-basic-lang';

const program = parseProgram('20 END\n10 LET SCORE = 1 + 2 * 3');
// program.lines has labels [10, 20], with original source locations.

const replacement = parseLine('10 PRINT SCORE;');
const candidate = [replacement, ...program.lines.filter(({label}) => label !== 10)];
const nextProgram = validateProgram(candidate);
// program is unchanged; nextProgram contains a separate, frozen snapshot.
```

## Parsing and validation boundaries

- `parseLine(source, {line = 1, offset = 0, dialect = 'native'} = {})` checks one numbered statement's
  lexical/statement syntax and returns a frozen `Line`. Blank input returns
  `null`. Multiple numbered statements and bare labels are rejected; the stored
  editor handles bare-label deletion before statement parsing. It neither
  checks another line's labels nor assigns variables. Supplied fragments begin
  at column 1; the options retain an original physical line and absolute offset.
- `parseProgram(source, {dialect = 'native'} = {})` tokenizes/parses the complete source, ignores blank
  lines, rejects duplicate labels, and returns a `Program` with lines sorted by
  numeric label. It checks every line, including lines after `END`, without
  executing any of them. `010` and `10` are duplicate labels.
- `validateProgram(lines, {dialect = 'native'} = {})` is the separate whole-program validation boundary.
  Pass an array of parsed `Line` nodes, excluding blank-edit `null` results. It
  checks duplicate labels, resolves every literal jump target, checks statically
  known comparison type mismatches, copies and sorts the candidate, pairs loops,
  and freezes the complete snapshot. It does not reorder/freeze the caller's array
  or retain mutable references to its nodes. This API expects parser-produced
  nodes; it is not a schema validator for untrusted or deserialized AST objects.

The parser supports `LET`, `INPUT`, `IF/THEN`, `GOTO`, `FOR`/`NEXT`, `PRINT`, `REM`, `CLS`, and
`END`. `parseLine` accepts unresolved
forward targets and leaves semantic comparison type checking to whole-program
validation, so editors can retain incomplete candidates. It also accepts an
unpaired `FOR` or `NEXT`. Full validation pairs nested loops by numeric program
order and rejects missing, extra, or mismatched named partners, including in
unreachable source. See [loop semantics](loops.md).

The file host reads a file once and passes its source to `Basic.runAsync()`, which
uses `parseProgram`; the parser has no filesystem access. A host should replace
its stored program only after a parse/validation
call succeeds. All APIs are stateless: a failed candidate leaves the previous
snapshot untouched and subsequent parses start fresh.

## Syntax trees

`OnStatement` has an expression `selector`, `transfer` (`goto` or `gosub`) and a
readonly `targets` list of literal-label NumberLiteral nodes. This explicit new
public union case preserves ordinary ON scalar/array names and supports grouped
selectors without mistaking them for array assignments. Complete validation
checks numeric selector type, every target and the inclusive 4096-target bound,
including dead/unselected clauses. See [computed dispatch](computed-dispatch.md).

`PrintUsingStatement` is distinct from ordinary PRINT. Its `format` and `items`
are expressions; `separators` records the actual template/value commas and an
optional terminal semicolon, with `trailingSemicolon` indicating that final
suppression. It is a new provisional Statement union case before the 1.0 freeze.
USING stays an identifier: only a comma outside parentheses after the initial
USING token selects formatted grammar. See [native PRINT USING](print-using.md).

Array syntax adds `DimStatement` with `declarations`, `ArrayDeclaration` with
`name`, `nameLocation` and literal `bounds`, and `ArrayReference` with `name`,
`nameLocation` and expression `indices`. `ArrayReference` is an Expression and a
valid LET target; public `AssignmentTarget` is the scalar/indexed target union.
These are additions to closed public unions before the 1.0 freeze. Loop variables
remain scalar; the [INPUT extension](input-targets.md) also accepts array targets.
Ordinary `NAME(...)` syntax is now an array
reference; built-ins still use CallExpression. Whole-program validation resolves
all declarations, ranks, statically string indices and resource limits before
effects, while parseLine permits undeclared/incomplete array edits. See
[native arrays](arrays.md) for the exact forms and diagnostic rules.

The root is `{type: 'Program', dialect: 'native', lines}`. Each `Line` has
`dialect`, `label`, `statement`, `source`, and `location`. `source` preserves the physical line's original text,
including leading/trailing spaces, without its LF/CRLF ending. Sorting leaves
physical positions unchanged.

`Dialect`, `LanguageOptions`, and `SourceOptions` are public types. Only `'native'`
is supported; historical profile names are rejected rather than silently falling
back. Missing metadata in a legacy caller-supplied Line or Program means native;
new snapshots always include it. Validation checks all Line metadata, and runtime
preparation also checks Program metadata. Unknown/conflicting metadata or options
throw `TypeError`, including on empty source or unreachable lines. This context
check does not make validation a general schema validator for arbitrary ASTs.
See the [dialect design](dialect-design.md) for the historical profile plan.

Every line, statement, and expression has a `location` containing `label`,
`start`, and `end`. Positions follow the [tokenizer convention](tokenizer.md):
1-based physical lines/columns, 0-based UTF-16 offsets, exclusive ends, and tabs
counting as one source column. Line/statement spans exclude trailing whitespace.

| Statement type          | Additional fields                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `LetStatement`          | `target` (`Variable` or `ArrayReference`) and `expression`. `LET` is optional.                                                      |
| `InputStatement`        | Existing single-scalar form: `target` (`Variable`) and `prompt` (`StringLiteral` or null). An optional literal prompt requires `;`. |
| `InputTargetsStatement` | New list/indexed form: readonly `targets` (`AssignmentTarget` list) and the same optional literal `prompt`.                         |
| `IfStatement`           | `condition` (`Comparison`) and `target` (`NumberLiteral`).                                                                          |
| `InlineIfStatement`     | `condition`, `consequent`, and nullable `alternate`; branch bodies or literal targets retain physical locations.                    |
| `GotoStatement`         | `target` (`NumberLiteral`).                                                                                                         |
| `ForStatement`          | Numeric `variable` (`Variable`), `start`/`end` expressions, and `step` (expression or null for default 1).                          |
| `NextStatement`         | Numeric `variable` (`Variable`); it is required.                                                                                    |
| `PrintStatement`        | `items` (expressions), `separators` (semicolon locations), and `trailingSemicolon`.                                                 |
| `RemStatement`          | `text`, including all whitespace/text after `REM`.                                                                                  |
| `ClsStatement`          | None. No arguments permitted.                                                                                                       |
| `EndStatement`          | None. No arguments permitted.                                                                                                       |

Blank `PRINT` has no items/separators and `trailingSemicolon: false`. Semicolon
locations include a trailing semicolon when present. Empty items, leading
semicolons, comma-based output zones, and trailing unconsumed tokens are errors.
String-involved adjacent items need no separator; `separators` still contains
only physical semicolons, with no synthetic entry for an omitted separator.
Expressions remain greedy, and numeric-only adjacency stays invalid. See
[adjacent PRINT items](print-adjacency.md).

| Expression type                   | Additional fields                                                |
| --------------------------------- | ---------------------------------------------------------------- |
| `NumberLiteral` / `StringLiteral` | `value` and original token `raw`.                                |
| `Variable`                        | Normalized uppercase `name`, including a final `$` when present. |
| `UnaryExpression`                 | `operator`, `operatorLocation`, and `argument`.                  |
| `BinaryExpression`                | `operator`, `operatorLocation`, `left`, and `right`.             |
| `GroupExpression`                 | `expression`; its location includes both parentheses.            |
| `CallExpression`                  | Normalized `name`, `nameLocation`, and `arguments`.              |

Multiplication/division bind more tightly than addition/subtraction; binary
operators associate left. Unary signs associate right and bind above binary
operators. Parentheses and calls are explicit nodes. `ABS`, `INT`, and `RND`
require parentheses. Other names with parentheses are array references, checked
against DIM during whole-program validation. Reserved names as variable targets
are rejected. Standalone legacy `ABS`/`INT` commands are not parser syntax.

`Comparison` is a separate node, not an expression value. It has `left`/`right`
expressions, `operator`, `operatorLocation`, and its own `location`. Its public
`ComparisonOperator` type is `= | <> | < | <= | > | >=`. Targets retain integer
`value`, original decimal `raw` spelling, and location. Decimal points, signs,
variables, parenthesized/computed targets, chained comparisons and Boolean
operators are rejected. Literal IF without ELSE retains IfStatement. Inline
THEN/ELSE and nested IF add InlineIfStatement with structured branches; IF ...
GOTO is an alias. ELSE is contextual and retains existing native names.
See [inline conditionals](inline-conditionals.md) for limits/body restrictions.

Whole-program validation checks comparison operand types using literals,
variable suffixes, operator/built-in result types, grouping, and homogeneous
`+` expressions. It rejects mixed types and string ordering at the comparison
operator without evaluating anything. Mixed `+` expressions have no valid
inferred result type and keep their evaluator diagnostics when reached. This
is not general constant evaluation: undefined variables, division by zero,
non-finite results, and built-in arity remain runtime checks. `parseLine` only
checks syntax. For example, `ABS()` has a valid call shape but fails arity when
evaluated. Nesting of groups, unary signs, and calls is
limited to 256 levels and produces a BASIC diagnostic when exceeded. Long flat
binary expressions use iterative parsing, copying, and freezing.

## Failure behavior

Syntax errors throw `BasicSyntaxError` with the existing structured `diagnostic`:
`{code, message, label, line, column, offset}`. `error.message` includes a readable
label/column (or physical line/column for invalid labels). Missing operands at
line end point to that line's boundary; duplicate labels point to their second
occurrence in physical input order. The parser never returns a partial snapshot.

Parser-specific codes are `EXPECTED_STATEMENT`, `EXPECTED_TOKEN`,
`EXPECTED_EXPRESSION`, `UNEXPECTED_TOKEN`, `UNSUPPORTED_STATEMENT`,
`UNKNOWN_FUNCTION`, `EXPECTED_COMPARISON`, `INVALID_TARGET`, and
`EXPRESSION_TOO_DEEP`. Whole-program validation adds `MISSING_TARGET` and
`TYPE_MISMATCH` for comparison types. Lexer diagnostics pass through;
loop validation adds `MISSING_NEXT`, `UNMATCHED_NEXT`, and `MISMATCHED_NEXT`.
`DUPLICATE_LABEL` is a program-validation failure and `INVALID_STATEMENT` reports
multiple statements supplied to `parseLine`.

`bun test` covers precedence, associativity, PRINT separators, exact source spans,
invalid/trailing syntax, duplicate labels, snapshots, and failure preservation.
`bun run test:package` verifies the public parser exports in installed ESM and
CommonJS consumers alongside the existing CLI/library checks.

`BasicSyntaxError` is exported from the public package entry. Consumers can
narrow caught errors without importing private source paths:

```ts
import {parseProgram, BasicSyntaxError} from 'node-basic-lang';

try {
  parseProgram('10 PRINT 1+');
} catch (error) {
  if (!(error instanceof BasicSyntaxError)) throw error;
  console.error(error.diagnostic.code, error.diagnostic.label);
}
```
