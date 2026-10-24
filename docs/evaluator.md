# Expression evaluation

The [language and session contract](language-v0.1.md) defines expression syntax
and value rules. This guide describes the standalone evaluator API.

The package exports `Evaluator` and `BasicRuntimeError`. Evaluation uses the
immutable expression nodes from the [parser API](parser.md), with no terminal,
filesystem, DOM, or Bun runtime dependency. Each evaluator owns its variables.
The CLI and `Basic.run()` use this evaluator through the
[statement runtime](interpreter-host.md).

```ts
import {Evaluator, parseLine} from 'node-basic-lang';

const evaluator = new Evaluator({random: () => 0.41});
const line = parseLine('10 LET SECRET = INT(RND() * 100) + 1');
if (line?.statement.type === 'LetStatement') {
  const {target, expression} = line.statement;
  const value = evaluator.evaluate(expression); // 42
  evaluator.assign(target, value);
}

const output = parseLine('20 PRINT SECRET + 1');
if (output?.statement.type === 'PrintStatement') {
  console.log(evaluator.evaluate(output.statement.items[0])); // 43
}
```

This example explicitly evaluates an expression and assigns its result. The
evaluator does not execute statements, print, sort programs, track run status,
or provide a program counter. Those belong to the execution loop.

## API and values

- `new Evaluator(host = {})` accepts an optional `random(): number` callback,
  using the same binding behavior as `createHost`. Methods retain their host
  receiver. The default random source is `Math.random`.
- `evaluate(expression): BasicValue` returns a finite number or a string. It
  reads this evaluator's variables without changing them or mutating the tree.
  `RND()` consumes the host's random sequence. Traversal is iterative, so long
  flat expressions do not consume the JavaScript call stack.
- `assign(target, value): void` takes a parsed `Variable` node and a number or
  string. Names are case-insensitive. A final `$` requires a string; all other
  names require finite numbers. Checks finish before the stored value changes,
  so an invalid assignment preserves any previous value.
- `reset(): void` clears all variables in this evaluator. It does not rewind or
  replace the host's random sequence. Other evaluator instances are unaffected.
- `compare(condition: Comparison): boolean` evaluates both operands left to
  right, then applies a numeric comparison or exact string equality/inequality.
  Comparison results are used by `IF`; they do not add a Boolean BASIC value type.

There is no implicit variable initialization or numeric/string conversion.
`A` and `A$` are distinct variables. Empty strings and zero are valid values.
Inputs must be parser-produced expression/variable nodes; this API is not a
schema validator for arbitrary or deserialized objects. It still rejects
non-finite numeric literal values rather than allowing them into computation.
Malformed numeric source spellings are rejected by the tokenizer before
evaluation.

## Operators and built-ins

The syntax tree supplies precedence, grouping, and associativity. Binary operands
and call arguments are evaluated left to right. If evaluating an operand fails,
later operands are not evaluated. Unary `+` and `-` require numbers. Binary
`+`, `-`, `*`, and `/` require numbers, except that `+` concatenates two strings.
Mixed operands fail without coercion. Division by either positive or negative
zero is an error, as is an arithmetic result outside the finite number range.
Numbers otherwise follow JavaScript's IEEE 754 arithmetic.

- `ABS(x)` takes one number and returns its absolute value.
- `INT(x)` takes one number and floors toward negative infinity:
  `INT(-1.6)` returns `-2`.
- `RND()` takes no arguments. The host must return a finite number `>= 0` and
  `< 1`. Invalid results fail rather than being clamped or retried. A thrown
  host error is wrapped with the function's source location and retained as
  `error.cause`.

Arity is checked before evaluating any arguments, so `ABS(RND(), RND())` fails
without consuming randomness. A failed evaluation leaves variables usable for
subsequent evaluations; it does not roll back random calls already made. The
execution loop stops a run when a statement fails.

## Errors and locations

Runtime failures throw `BasicRuntimeError`, distinct from `BasicSyntaxError`.
Both expose a structured `diagnostic` with
`{code, message, label, line, column, offset}` and a readable `error.message`.
Locations retain the parser's original physical positions even when program
lines have been sorted by numeric label.

| Code                     | Meaning                                              | Location                                      |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------- |
| `UNDEFINED_VARIABLE`     | Read before assignment                               | Variable token                                |
| `TYPE_MISMATCH`          | Incompatible operand, argument, or assigned value    | Operator, function name, or assignment target |
| `DIVISION_BY_ZERO`       | Zero divisor                                         | Division operator                             |
| `NON_FINITE_NUMBER`      | Non-finite literal, assignment, or arithmetic result | Literal, target, or operator                  |
| `INVALID_ARGUMENT_COUNT` | Built-in called with the wrong number of arguments   | Function name                                 |
| `INVALID_RANDOM_VALUE`   | Host random result violates the range/type contract  | `RND` name                                    |
| `RANDOM_FAILED`          | Host random callback throws                          | `RND` name                                    |

The parser rejects unknown functions and unsupported operators before
evaluation. The evaluator also reports `UNKNOWN_FUNCTION` and
`UNSUPPORTED_OPERATOR` for constructed nodes containing those values.

```ts
import {BasicRuntimeError} from 'node-basic-lang';

try {
  const invalid = parseLine('30 PRINT 1 / 0');
  if (invalid?.statement.type === 'PrintStatement') {
    evaluator.evaluate(invalid.statement.items[0]);
  }
} catch (error) {
  if (!(error instanceof BasicRuntimeError)) throw error;
  console.error(error.diagnostic.code, error.message);
}
```

`bun test` covers arithmetic and string semantics, typed assignment, isolation,
reset and recovery, deterministic randomness and ordering, source locations,
numeric/host failures, and flat/nested expression limits. The package check
verifies evaluator imports and error identity in installed ESM and CommonJS
consumers, plus use from a strict TypeScript consumer.
