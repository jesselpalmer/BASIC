# Tokenization and source diagnostics

The [language and session contract](language-v1.md) defines supported syntax;
recognizing a token alone does not make it an executable statement.

`src/parser/tokenizer.ts` provides the internal, host-independent
`tokenize(source, options = {})` function. It performs no execution, filesystem
access, or JavaScript evaluation. Every call owns its state; tokenizing a failed
or successful input cannot affect another call.

The default input is numbered BASIC source. Blank lines are accepted. The
tokenizer enforces complete decimal labels in the range 1–65535 and requires a
space/tab between a label and its statement. Leading zeros retain their original
text but produce the same numeric identity. A bare label is lexically valid;
the parser rejects it as a missing statement. The stored editor handles
bare-label deletion before calling the parser.

Options are `numbered` (default `true`), `line` (starting physical line, default
`1`), and `offset` (starting source offset, default `0`). The legacy library
`Basic.readLine` adapter accepts `line` and `offset` for source fragments. Setting
`numbered: false` permits unnumbered tokens; it does not implement or execute
editor commands. The REPL routes its session commands separately. A supplied fragment begins at
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
| `KEYWORD`     | Uppercase reserved word, including built-ins and session commands.      |
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

`src/dictionaries/reserved_words.ts` supplies the active lexical set. It includes
statement words, grammar words (`THEN`, `TO`, `STEP`), built-ins (`ABS`, `INT`,
`RND`), and session commands (`RUN`, `LIST`, `NEW`, `LOAD`, `SAVE`, `EXIT`). Session
commands are reserved names but are rejected as numbered BASIC statements;
`repl/repl.ts` routes them separately. The parser's statement switch and the
runtime's dispatch determine executable statements. This dictionary is neither
an unused legacy list nor a promise that every keyword is a statement.

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
`UNEXPECTED_CHARACTER`. The parser and runtime also use
`DUPLICATE_LABEL` and `INVALID_STATEMENT` with the same diagnostic shape.

The [parser API](parser.md) consumes these tokens to build syntax trees and
immutable programs sorted by label. The CLI and `Basic` execute these programs
through the shared [runtime](interpreter-host.md) and [evaluator](evaluator.md).
Files validate completely before any output, including source after `END`.
Keywords are case-insensitive, spaces/tabs and doubled quotes are accepted, and
duplicate labels are compared numerically. The immediate-entry adapter also
uses the same parser and statement executor; no legacy command fallback remains.

`bun test` covers token values/boundaries, exact positions, malformed inputs,
state isolation, interpreter integration, and CLI diagnostics/recovery.
