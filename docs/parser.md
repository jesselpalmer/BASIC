# Parser API and program snapshots

The package exports `parseLine`, `parseProgram`, and `validateProgram`. They
consume source/parsed lines and return immutable data without executing BASIC,
reading files, opening a terminal, evaluating JavaScript, or retaining program
state between calls. The CLI and `Basic.run()` still use the legacy executor;
the evaluator and new runtime follow in #36 and #37.

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

- `parseLine(source, {line = 1, offset = 0} = {})` checks one numbered statement's
  lexical/statement syntax and returns a frozen `Line`. Blank input returns
  `null`. Multiple numbered statements and bare labels are rejected; a future
  editor will handle bare-label deletion before statement parsing. It neither
  checks another line's labels nor assigns variables. Supplied fragments begin
  at column 1; the options retain an original physical line and absolute offset.
- `parseProgram(source)` tokenizes/parses the complete source, ignores blank
  lines, rejects duplicate labels, and returns a `Program` with lines sorted by
  numeric label. It checks every line, including lines after `END`, without
  executing any of them. `010` and `10` are duplicate labels.
- `validateProgram(lines)` is the separate whole-program validation boundary.
  Pass an array of parsed `Line` nodes, excluding blank-edit `null` results. It
  currently checks duplicate labels, copies the candidate, sorts the copy, and
  freezes the complete snapshot. It does not reorder/freeze the caller's array
  or retain mutable references to its nodes.

Only `LET`, `PRINT`, `REM`, `CLS`, and `END` statements are supported by this
parser. `INPUT`, jumps, and loops still fail explicitly; their feature tickets
add their own grammar. Forward-target resolution and loop pairing will be added
to `validateProgram`, keeping `parseLine` usable for incomplete edits. They are
not performed, or claimed to be supported, by this initial parser.

Hosts read files once and pass the resulting string to `parseProgram`; the
parser has no filesystem access. The existing file adapter retains its single
read. A host should replace its stored program only after a parse/validation
call succeeds. All APIs are stateless: a failed candidate leaves the previous
snapshot untouched and subsequent parses start fresh.

## Syntax trees

The root is `{type: 'Program', lines}`. Each `Line` has `label`, `statement`,
`source`, and `location`. `source` preserves the physical line's original text,
including leading/trailing spaces, without its LF/CRLF ending. Sorting leaves
physical positions unchanged.

Every line, statement, and expression has a `location` containing `label`,
`start`, and `end`. Positions follow the [tokenizer convention](tokenizer.md):
1-based physical lines/columns, 0-based UTF-16 offsets, exclusive ends, and tabs
counting as one source column. Line/statement spans exclude trailing whitespace.

| Statement type | Additional fields |
| --- | --- |
| `LetStatement` | `target` (`Variable`) and `expression`. `LET` is required. |
| `PrintStatement` | `items` (expressions), `separators` (semicolon locations), and `trailingSemicolon`. |
| `RemStatement` | `text`, including all whitespace/text after `REM`. |
| `ClsStatement` | None. No arguments permitted. |
| `EndStatement` | None. No arguments permitted. |

Blank `PRINT` has no items/separators and `trailingSemicolon: false`. Semicolon
locations include a trailing semicolon when present. Empty items, leading
semicolons, comma-based output zones, and trailing unconsumed tokens are errors.

| Expression type | Additional fields |
| --- | --- |
| `NumberLiteral` / `StringLiteral` | `value` and original token `raw`. |
| `Variable` | Normalized uppercase `name`, including a final `$` when present. |
| `UnaryExpression` | `operator`, `operatorLocation`, and `argument`. |
| `BinaryExpression` | `operator`, `operatorLocation`, `left`, and `right`. |
| `GroupExpression` | `expression`; its location includes both parentheses. |
| `CallExpression` | Normalized `name`, `nameLocation`, and `arguments`. |

Multiplication/division bind more tightly than addition/subtraction; binary
operators associate left. Unary signs associate right and bind above binary
operators. Parentheses and calls are explicit nodes. `ABS`, `INT`, and `RND`
require parentheses; unknown functions and reserved names as variable targets
are rejected. Standalone legacy `ABS`/`INT` commands are not parser syntax.

Parsing does not evaluate expressions or check types, variable initialization,
division by zero, or built-in arity. For example, `ABS()` has a valid call shape
but will fail arity checking in the evaluator. Comparisons are not expressions;
they arrive with the `IF` grammar. Nesting of groups, unary signs, and calls is
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
`UNKNOWN_FUNCTION`, and `EXPRESSION_TOO_DEEP`. Lexer diagnostics pass through;
`DUPLICATE_LABEL` is a program-validation failure and `INVALID_STATEMENT` reports
multiple statements supplied to `parseLine`.

`npm test` covers precedence, associativity, PRINT separators, exact source spans,
invalid/trailing syntax, duplicate labels, snapshots, and failure preservation.
`npm run test:package` verifies the public parser exports in installed ESM and
CommonJS consumers alongside the existing CLI/library checks.
