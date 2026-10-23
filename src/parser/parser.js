import {BasicSyntaxError} from '../core/diagnostic.js';
import {tokenize} from './tokenizer.js';

const functions = new Set(['ABS', 'INT', 'RND']);
const maxNesting = 256;

export function parseLine(source, options = {}) {
  const lines = new Parser(source, options).parse();
  if (lines.length > 1) {
    const extra = lines[1];
    throw new BasicSyntaxError('INVALID_STATEMENT',
        'Expected one numbered statement', extra.location.start, extra.label);
  }
  return lines.length === 0 ? null : freezeTree(lines[0]);
}

export function parseProgram(source) {
  return validateProgram(new Parser(source).parse());
}

// This is the whole-program validation boundary. Future jump/loop tickets add
// target resolution and pairing here, without tightening single-line parsing.
export function validateProgram(lines) {
  if (!Array.isArray(lines) || lines.some((line) => line?.type !== 'Line')) {
    throw new TypeError('Expected an array of parsed lines');
  }
  const labels = new Set();
  for (const line of lines) {
    if (labels.has(line.label)) {
      throw new BasicSyntaxError('DUPLICATE_LABEL',
          `Duplicate line label ${line.label}`,
          line.location.start, line.label);
    }
    labels.add(line.label);
  }
  // Clone before freezing: a snapshot never freezes or retains caller-owned
  // arrays/nodes, and a failed candidate cannot modify an existing program.
  const snapshot = copyTree(lines).sort((a, b) => a.label - b.label);
  return freezeTree({type: 'Program', lines: snapshot});
}

// ASTs contain only plain objects, arrays, and primitives. Copy iteratively so
// a long left-associative expression cannot exhaust the JavaScript call stack.
function copyTree(root) {
  const copy = [];
  const copies = new Map([[root, copy]]);
  const pending = [root];
  while (pending.length) {
    const source = pending.pop();
    const target = copies.get(source);
    for (const [key, value] of Object.entries(source)) {
      if (value !== null && typeof value === 'object') {
        if (!copies.has(value)) {
          copies.set(value, Array.isArray(value) ? [] : {});
          pending.push(value);
        }
        target[key] = copies.get(value);
      } else {
        target[key] = value;
      }
    }
  }
  return copy;
}

function freezeTree(root) {
  const pending = [root];
  const visited = new Set();
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object' || visited.has(value)) {
      continue;
    }
    visited.add(value);
    for (const child of Object.values(value)) pending.push(child);
    Object.freeze(value);
  }
  return root;
}

class Parser {
  constructor(source, {line = 1, offset = 0} = {}) {
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

  at(type, value) {
    return this.peek().type === type &&
      (value === undefined || this.peek().value === value);
  }

  atEnd() {
    return this.at('NEWLINE') || this.at('EOF');
  }

  fail(code, message, token = this.peek()) {
    throw new BasicSyntaxError(code, message, token.start, this.label);
  }

  expect(type, value, message) {
    if (!this.at(type, value)) this.fail('EXPECTED_TOKEN', message);
    return this.take();
  }

  location(first, last = first) {
    return {
      label: this.label,
      start: {...(first.location ?? first).start},
      end: {...(last.location ?? last).end},
    };
  }

  node(type, first, last, fields = {}) {
    return {type, ...fields, location: this.location(first, last)};
  }

  nested(token, parse) {
    if (this.depth >= maxNesting) {
      this.fail('EXPRESSION_TOO_DEEP',
          `Expression nesting exceeds ${maxNesting}`, token);
    }
    this.depth++;
    try {
      return parse();
    } finally {
      this.depth--;
    }
  }

  parse() {
    const lines = [];
    while (!this.at('EOF')) {
      if (this.at('NEWLINE')) {
        this.lineStart = this.take().end.offset - this.offset;
        continue;
      }
      const label = this.take(); // The tokenizer enforces numbered lines.
      this.label = label.value;
      const statement = this.statement();
      if (!this.atEnd()) {
        this.fail('UNEXPECTED_TOKEN',
            `Unexpected token ${JSON.stringify(this.peek().raw)}`);
      }
      const end = this.peek().start.offset - this.offset;
      lines.push(this.node('Line', label, statement, {
        label: label.value,
        source: this.source.slice(this.lineStart, end),
        statement,
      }));
    }
    return lines;
  }

  statement() {
    const command = this.peek();
    if (this.atEnd()) {
      this.fail('EXPECTED_STATEMENT', 'Expected a statement after the label');
    }
    if (command.type !== 'KEYWORD') {
      this.fail('UNSUPPORTED_STATEMENT',
          `Unsupported statement ${JSON.stringify(command.raw)}`);
    }
    this.take();
    switch (command.value) {
      case 'LET': {
        const name = this.expect('IDENTIFIER', undefined,
            'Expected a variable name after LET');
        const target = this.node('Variable', name, name, {name: name.value});
        this.expect('OPERATOR', '=', 'Expected = after the variable name');
        const expression = this.expression();
        return this.node('LetStatement', command, expression,
            {target, expression});
      }
      case 'PRINT':
        return this.print(command);
      case 'REM': {
        const comment = this.take(); // REM always emits a COMMENT token.
        return this.node('RemStatement', command, comment,
            {text: comment.value});
      }
      case 'CLS':
        return this.node('ClsStatement', command, command);
      case 'END':
        return this.node('EndStatement', command, command);
      default:
        this.fail('UNSUPPORTED_STATEMENT',
            `Unsupported statement ${command.raw}`, command);
    }
  }

  print(command) {
    const items = [];
    const separators = [];
    let trailingSemicolon = false;
    let last = command;
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
    return this.node('PrintStatement', command, last,
        {items, separators, trailingSemicolon});
  }

  expression() {
    return this.binary(() => this.term(), ['+', '-']);
  }

  term() {
    return this.binary(() => this.unary(), ['*', '/']);
  }

  binary(operand, operators) {
    let left = operand();
    while (this.at('OPERATOR') && operators.includes(this.peek().value)) {
      const operator = this.take();
      const right = operand();
      left = this.node('BinaryExpression', left, right, {
        operator: operator.value, operatorLocation: this.location(operator),
        left, right,
      });
    }
    return left;
  }

  unary() {
    if (this.at('OPERATOR', '+') || this.at('OPERATOR', '-')) {
      const operator = this.take();
      const argument = this.nested(operator, () => this.unary());
      return this.node('UnaryExpression', operator, argument, {
        operator: operator.value, operatorLocation: this.location(operator),
        argument,
      });
    }
    return this.primary();
  }

  primary() {
    const token = this.peek();
    if (this.at('NUMBER') || this.at('STRING')) {
      this.take();
      return this.node(token.type === 'NUMBER' ? 'NumberLiteral' :
        'StringLiteral', token, token, {value: token.value, raw: token.raw});
    }
    if (this.at('IDENTIFIER')) {
      this.take();
      if (this.at('PUNCTUATION', '(')) {
        this.fail('UNKNOWN_FUNCTION', `Unknown function ${token.value}`, token);
      }
      return this.node('Variable', token, token, {name: token.value});
    }
    if (this.at('KEYWORD') && functions.has(token.value)) {
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

  call() {
    const name = this.take();
    const open = this.expect('PUNCTUATION', '(',
        `Expected ( after ${name.value}`);
    return this.nested(open, () => {
      const args = [];
      if (!this.at('PUNCTUATION', ')')) {
        for (;;) {
          args.push(this.expression());
          if (!this.at('PUNCTUATION', ',')) break;
          this.take();
        }
      }
      const close = this.expect('PUNCTUATION', ')', 'Expected closing )');
      return this.node('CallExpression', name, close, {
        name: name.value, nameLocation: this.location(name), arguments: args,
      });
    });
  }
}
