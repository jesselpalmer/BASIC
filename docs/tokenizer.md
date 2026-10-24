# Tokenization and source diagnostics

`src/parser/tokenizer.ts` provides the internal, host-independent
`tokenize(source, options = {})` function. It performs no execution, filesystem
access, or JavaScript evaluation. Every call owns its state; tokenizing a failed
or successful input cannot affect another call.

The default input is numbered BASIC source. Blank lines are accepted. The
tokenizer enforces complete decimal labels in the range 1–65535 and requires a
space/tab between a label and its statement. Leading zeros retain their original
text but produce the same numeric identity. A bare label is lexically valid;
the current executor rejects it as a missing statement. The future editor will
interpret it as deletion.

Options are `numbered` (default `true`), `line` (starting physical line, default
`1`), and `offset` (starting source offset, default `0`). The existing executor
uses `line` and `offset` when scanning individual physical lines. Setting
`numbered: false` permits tokenization of future unnumbered editor commands; it
does not implement or execute those commands. A supplied fragment begins at
column 1.

## Tokens

Each token has `type`, `value`, `raw`, `label`, `start`, and `end` fields. `raw`
is the exact source spelling. Positions are `{line, column, offset}`; lines and
columns are 1-based, offsets are 0-based, and `end` is exclusive. Columns and
offsets count JavaScript UTF-16 code units, so a tab counts as one source column.
`label` is the current numeric BASIC label, or `null` on unnumbered/blank lines.

| Type          | Value                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| `LABEL`       | Numeric label, with original spelling in `raw`.                         |
| `KEYWORD`     | Uppercase keyword or built-in function name from the v0.1 contract.     |
| `IDENTIFIER`  | Uppercase ASCII name, optionally ending in `$`.                         |
| `NUMBER`      | Finite unsigned decimal value; `+` and `-` are separate operators.      |
| `STRING`      | Decoded text: doubled quotes become one quote; other text is unchanged. |
| `OPERATOR`    | `+`, `-`, `*`, `/`, `=`, `<>`, `<`, `<=`, `>`, or `>=`.                 |
| `PUNCTUATION` | `(`, `)`, `;`, or `,`. Recognition does not imply a valid statement.    |
| `COMMENT`     | Everything after `REM` until the line ending, including leading spaces. |
| `NEWLINE`     | `null`; `raw` preserves LF or CRLF, and `end` starts the next line.     |
| `EOF`         | `null`; zero-width position immediately after the source.               |

Spaces and tabs outside strings/comments are skipped. Newlines remain explicit
statement boundaries. `REM` produces a comment token even for an empty comment.
String values retain case, whitespace, and backslashes. Strings cannot cross a
physical line. Identifier boundaries matter: `REMARK` and `PRINT2$` are names,
not keywords followed by fragments.

Numeric-looking words must be complete decimal literals. `12oops`, `1e2`,
`0x10`, `1.2.3`, and non-finite decimal values fail instead of yielding a valid
numeric prefix. `NaN` and `Infinity` follow the identifier grammar; they are
never special numeric literals. Colons, apostrophe comments, lone CR, and other
unsupported characters fail outside strings/comments.

## Errors and current integration

`BasicSyntaxError` extends `SyntaxError`. Its `diagnostic` contains `code`,
unformatted `message`, `label`, `line`, `column`, and `offset`. The formatted
`error.message` is suitable for the existing CLI:

```text
Line 20, column 10: Unterminated string
Source line 2, column 3: Invalid line label "10abc"; expected 1 through 65535
```

Invalid labels have `label: null`, so the error identifies the physical source
line. Unterminated strings point at their opening quote. Lexer codes are
`INVALID_LABEL`, `INVALID_NUMBER`, `UNTERMINATED_STRING`, and
`UNEXPECTED_CHARACTER`. The existing line validator/executor also use
`DUPLICATE_LABEL` and `INVALID_STATEMENT` with the same diagnostic shape.

Both the CLI and `Basic` now use tokens for the existing commands, replacing
space/quote splitting. They accept lowercase commands, flexible spaces/tabs,
and doubled quotes. They require exactly one quoted argument for legacy
`PRINT`/`ABS`/`INT`, no arguments for `CLS`/`END`, and reject trailing operands.
Duplicate labels are compared numerically.

The separate [parser API](parser.md) consumes these tokens to build syntax trees
and immutable programs sorted by label. The existing CLI and `Basic` still use
the small legacy adapter; `END` stops scanning/execution of subsequent file lines
there. The separate [evaluator API](evaluator.md) evaluates parsed expressions;
execution of parsed programs and stored editing follow in the runtime/editor
tickets.

`bun test` covers token values/boundaries, exact positions, malformed inputs,
state isolation, interpreter integration, and CLI diagnostics/recovery.
