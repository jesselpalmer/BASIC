import type {
  SourceOptions,
  ParsedLine,
  Program,
  Token,
  TokenType,
  TokenValues,
  TokenOf,
  Location,
  NodeFields,
  NodeOf,
  Expression,
  Statement,
  ComparisonOperator,
} from '../core/types.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {freezeTree, validateProgram} from './program_validation.ts';

export {validateProgram} from './program_validation.ts';
import {tokenize} from './tokenizer.ts';

const functions = new Set(['ABS', 'INT', 'RND', 'INKEY$', 'KEYDOWN']);
const maxNesting = 256;
const comparisonOperators = new Set(['=', '<>', '<', '<=', '>', '>=']);

export function parseLine(source: string, options: SourceOptions = {}): ParsedLine | null {
  const lines = new Parser(source, options).parse();
  if (lines.length > 1) {
    const extra = lines[1];
    throw new BasicSyntaxError(
      'INVALID_STATEMENT',
      'Expected one numbered statement',
      extra.location.start,
      extra.label,
    );
  }
  return lines.length === 0 ? null : freezeTree(lines[0]);
}

export function parseProgram(source: string): Program {
  return validateProgram(new Parser(source).parse());
}

class Parser {
  readonly source: string;
  readonly offset: number;
  readonly tokens: Token[];
  index: number;
  lineStart: number;
  label: number | null;
  depth: number;
  constructor(source: string, {line = 1, offset = 0}: SourceOptions = {}) {
    this.source = source;
    this.offset = offset;
    this.tokens = tokenize(source, {line, offset});
    this.index = 0;
    this.lineStart = 0;
    this.label = null;
    this.depth = 0;
  }

  peek() {
    return this.tokens[this.index];
  }

  take() {
    return this.tokens[this.index++];
  }

  at(type: TokenType, value?: TokenValues[TokenType]) {
    return this.peek().type === type && (value === undefined || this.peek().value === value);
  }

  atEnd() {
    return this.at('NEWLINE') || this.at('EOF');
  }

  fail(code: string, message: string, token = this.peek()): never {
    throw new BasicSyntaxError(code, message, token.start, this.label);
  }

  expect<K extends TokenType>(
    type: K,
    value: TokenValues[K] | undefined,
    message: string,
  ): TokenOf<K> {
    if (!this.at(type, value)) this.fail('EXPECTED_TOKEN', message);
    return this.take() as TokenOf<K>;
  }

  location(
    first: Token | {location: Location},
    last: Token | {location: Location} = first,
  ): Location {
    return {
      label: this.label,
      start: {...('location' in first ? first.location : first).start},
      end: {...('location' in last ? last.location : last).end},
    };
  }

  node<K extends keyof NodeFields>(
    type: K,
    first: Token | {location: Location},
    last: Token | {location: Location},
    fields: NodeFields[K],
  ): NodeOf<K> {
    return {type, ...fields, location: this.location(first, last)} as NodeOf<K>;
  }

  nested<T>(token: Token, parse: () => T): T {
    if (this.depth >= maxNesting) {
      this.fail('EXPRESSION_TOO_DEEP', `Expression nesting exceeds ${maxNesting}`, token);
    }
    this.depth++;
    try {
      return parse();
    } finally {
      this.depth--;
    }
  }

  parse() {
    const lines: ParsedLine[] = [];
    while (!this.at('EOF')) {
      if (this.at('NEWLINE')) {
        this.lineStart = this.take().end.offset - this.offset;
        continue;
      }
      const label = this.expect('LABEL', undefined, 'Expected a line label');
      this.label = label.value;
      const statement = this.statement();
      if (!this.atEnd()) {
        this.fail('UNEXPECTED_TOKEN', `Unexpected token ${JSON.stringify(this.peek().raw)}`);
      }
      const end = this.peek().start.offset - this.offset;
      lines.push(
        this.node('Line', label, statement, {
          label: label.value,
          source: this.source.slice(this.lineStart, end),
          statement,
        }),
      );
    }
    return lines;
  }

  statement(): Statement {
    const command = this.peek();
    if (this.atEnd()) {
      this.fail('EXPECTED_STATEMENT', 'Expected a statement after the label');
    }
    if (command.type === 'IDENTIFIER') {
      const following = this.tokens[this.index + 1];
      if (following.type === 'OPERATOR' && following.value === '=') {
        this.take();
        return this.assignment(command, command);
      }
      // GO stays a variable name. Only the statement-position pair GO TO
      // is an alias; splitting arbitrary names would change native programs.
      if (command.value === 'GO' && following.type === 'KEYWORD' && following.value === 'TO') {
        this.take();
        this.take();
        return this.goto(command);
      }
    }
    if (command.type !== 'KEYWORD') {
      this.fail('UNSUPPORTED_STATEMENT', `Unsupported statement ${JSON.stringify(command.raw)}`);
    }
    this.take();
    switch (command.value) {
      case 'LET': {
        const name = this.expect('IDENTIFIER', undefined, 'Expected a variable name after LET');
        return this.assignment(command, name);
      }
      case 'PRINT':
        return this.print(command);
      case 'FOR': {
        const variable = this.loopVariable();
        this.expect('OPERATOR', '=', 'Expected = after the loop variable');
        const start = this.expression();
        this.expect('KEYWORD', 'TO', 'Expected TO after the loop start');
        const end = this.expression();
        let step: Expression | null = null;
        if (this.at('KEYWORD', 'STEP')) {
          this.take();
          step = this.expression();
        }
        return this.node('ForStatement', command, step ?? end, {variable, start, end, step});
      }
      case 'NEXT': {
        const variable = this.loopVariable();
        return this.node('NextStatement', command, variable, {variable});
      }
      case 'GOTO':
        return this.goto(command);
      case 'IF': {
        const left = this.expression();
        const operator = this.peek();
        if (operator.type !== 'OPERATOR' || !comparisonOperators.has(operator.value)) {
          this.fail('EXPECTED_COMPARISON', 'Expected one comparison operator', operator);
        }
        this.take();
        const right = this.expression();
        const condition = this.node('Comparison', left, right, {
          left,
          right,
          operator: operator.value as ComparisonOperator,
          operatorLocation: this.location(operator),
        });
        this.expect('KEYWORD', 'THEN', 'Expected THEN followed by a literal line label');
        const target = this.jumpTarget();
        return this.node('IfStatement', command, target, {condition, target});
      }
      case 'INPUT': {
        let prompt: NodeOf<'StringLiteral'> | null = null;
        if (this.at('STRING')) {
          const text = this.expect('STRING', undefined, 'Expected a quoted prompt');
          prompt = this.node('StringLiteral', text, text, {value: text.value, raw: text.raw});
          this.expect('PUNCTUATION', ';', 'Expected ; after the INPUT prompt');
        }
        const name = this.expect('IDENTIFIER', undefined, 'Expected one variable after INPUT');
        const target = this.node('Variable', name, name, {name: name.value});
        return this.node('InputStatement', command, target, {prompt, target});
      }
      case 'REM': {
        const comment = this.expect('COMMENT', undefined, 'Expected comment');
        return this.node('RemStatement', command, comment, {text: comment.value});
      }
      case 'WAIT': {
        const duration = this.expression();
        return this.node('WaitStatement', command, duration, {duration});
      }
      case 'COLOR': {
        const color = this.expression();
        return this.node('ColorStatement', command, color, {color});
      }
      case 'PSET': {
        const x = this.expression();
        this.comma();
        const y = this.expression();
        return this.node('PsetStatement', command, y, {x, y});
      }
      case 'LINE': {
        const x1 = this.expression();
        this.comma();
        const y1 = this.expression();
        this.comma();
        const x2 = this.expression();
        this.comma();
        const y2 = this.expression();
        return this.node('LineStatement', command, y2, {x1, y1, x2, y2});
      }
      case 'CIRCLE': {
        const x = this.expression();
        this.comma();
        const y = this.expression();
        this.comma();
        const radius = this.expression();
        return this.node('CircleStatement', command, radius, {x, y, radius});
      }
      case 'CLS':
        return this.node('ClsStatement', command, command, {});
      case 'END':
        return this.node('EndStatement', command, command, {});
      default:
        this.fail('UNSUPPORTED_STATEMENT', `Unsupported statement ${command.raw}`, command);
    }
  }

  comma(): void {
    this.expect('PUNCTUATION', ',', 'Expected , between graphics arguments');
  }

  assignment(command: Token, name: TokenOf<'IDENTIFIER'>): NodeOf<'LetStatement'> {
    const target = this.node('Variable', name, name, {name: name.value});
    this.expect('OPERATOR', '=', 'Expected = after the variable name');
    const expression = this.expression();
    return this.node('LetStatement', command, expression, {target, expression});
  }

  goto(command: Token): NodeOf<'GotoStatement'> {
    const target = this.jumpTarget();
    return this.node('GotoStatement', command, target, {target});
  }

  print(command: Token) {
    const items: Expression[] = [];
    const separators: Location[] = [];
    let trailingSemicolon = false;
    let last: Token | Expression = command;
    if (!this.atEnd()) {
      for (;;) {
        last = this.expression();
        items.push(last);
        if (!this.at('PUNCTUATION', ';')) break;
        last = this.take();
        separators.push(this.location(last));
        if (this.atEnd()) {
          trailingSemicolon = true;
          break;
        }
      }
    }
    return this.node('PrintStatement', command, last, {items, separators, trailingSemicolon});
  }

  jumpTarget(): NodeOf<'NumberLiteral'> {
    const token = this.peek();
    if (
      token.type !== 'NUMBER' ||
      !/^\d+$/.test(token.raw) ||
      token.value < 1 ||
      token.value > 65535
    ) {
      this.fail('INVALID_TARGET', 'Expected a literal line label from 1 through 65535', token);
    }
    this.take();
    return this.node('NumberLiteral', token, token, {value: token.value, raw: token.raw});
  }

  loopVariable(): NodeOf<'Variable'> {
    const name = this.expect('IDENTIFIER', undefined, 'Expected a numeric loop variable');
    if (name.value.endsWith('$'))
      this.fail('TYPE_MISMATCH', 'Loop variables must be numeric', name);
    return this.node('Variable', name, name, {name: name.value});
  }

  expression(): Expression {
    return this.binary(() => this.term(), ['+', '-']);
  }

  term(): Expression {
    return this.binary(() => this.unary(), ['*', '/']);
  }

  binary(operand: () => Expression, operators: string[]): Expression {
    let left = operand();
    while (this.at('OPERATOR') && operators.includes(String(this.peek().value))) {
      const operator = this.take();
      const right = operand();
      left = this.node('BinaryExpression', left, right, {
        operator: operator.value as string,
        operatorLocation: this.location(operator),
        left,
        right,
      });
    }
    return left;
  }

  unary(): Expression {
    if (this.at('OPERATOR', '+') || this.at('OPERATOR', '-')) {
      const operator = this.take();
      const argument = this.nested(operator, () => this.unary());
      return this.node('UnaryExpression', operator, argument, {
        operator: operator.value as string,
        operatorLocation: this.location(operator),
        argument,
      });
    }
    return this.primary();
  }

  primary(): Expression {
    const token = this.peek();
    if (token.type === 'NUMBER' || token.type === 'STRING') {
      this.take();
      return token.type === 'NUMBER'
        ? this.node('NumberLiteral', token, token, {value: token.value, raw: token.raw})
        : this.node('StringLiteral', token, token, {value: token.value, raw: token.raw});
    }
    if (token.type === 'IDENTIFIER') {
      this.take();
      if (this.at('PUNCTUATION', '(')) {
        this.fail('UNKNOWN_FUNCTION', `Unknown function ${token.value}`, token);
      }
      return this.node('Variable', token, token, {name: token.value});
    }
    if (token.type === 'KEYWORD' && functions.has(token.value)) {
      return this.call();
    }
    if (this.at('PUNCTUATION', '(')) {
      this.take();
      const expression = this.nested(token, () => this.expression());
      const close = this.expect('PUNCTUATION', ')', 'Expected closing )');
      return this.node('GroupExpression', token, close, {expression});
    }
    this.fail('EXPECTED_EXPRESSION', 'Expected an expression');
  }

  call(): Expression {
    const name = this.expect('KEYWORD', undefined, 'Expected function name');
    const open = this.expect('PUNCTUATION', '(', `Expected ( after ${name.value}`);
    return this.nested(open, () => {
      const args: Expression[] = [];
      if (!this.at('PUNCTUATION', ')')) {
        for (;;) {
          args.push(this.expression());
          if (!this.at('PUNCTUATION', ',')) break;
          this.take();
        }
      }
      const close = this.expect('PUNCTUATION', ')', 'Expected closing )');
      return this.node('CallExpression', name, close, {
        name: name.value,
        nameLocation: this.location(name),
        arguments: args,
      });
    });
  }
}
