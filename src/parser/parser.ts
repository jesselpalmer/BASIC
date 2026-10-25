import type {
  SourceOptions,
  LanguageOptions,
  Dialect,
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
  SimpleStatement,
  ComparisonOperator,
} from '../core/types.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {expressionType} from '../core/comparison.ts';
import {validateDialect} from '../core/dialect.ts';
import {maxPrintUsingValues} from '../core/print_using.ts';
import {maxLineStatements, maxConditionalDepth, inlineBodyAllowed} from '../core/instructions.ts';
import {maxDataListItems} from '../core/data.ts';
import {maxInputTargets} from '../core/input.ts';
import {maxDispatchTargets} from '../core/dispatch.ts';
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

export function parseProgram(source: string, options: LanguageOptions = {}): Program {
  const dialect = validateDialect(options.dialect);
  return validateProgram(new Parser(source, {dialect}).parse(), {dialect});
}

class Parser {
  readonly dialect: Dialect;
  readonly source: string;
  readonly offset: number;
  readonly tokens: Token[];
  index: number;
  lineStart: number;
  label: number | null;
  depth: number;
  conditionalDepth = 0;
  branchDepth = 0;
  lineStatementCount = 0;
  constructor(source: string, {line = 1, offset = 0, dialect}: SourceOptions = {}) {
    this.dialect = validateDialect(dialect);
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

  atStatementEnd() {
    return this.atEnd() || this.at('PUNCTUATION', ':') || (this.branchDepth > 0 && this.atElse());
  }

  atElse() {
    const following = this.tokens[this.index + 1];
    return (
      this.at('IDENTIFIER', 'ELSE') &&
      !(following.type === 'OPERATOR' && following.value === '=') &&
      !(following.type === 'PUNCTUATION' && following.value === '(')
    );
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
      this.lineStatementCount = 0;
      const statement = this.sequence();
      if (!this.atEnd()) {
        this.fail('UNEXPECTED_TOKEN', `Unexpected token ${JSON.stringify(this.peek().raw)}`);
      }
      const end = this.peek().start.offset - this.offset;
      lines.push(
        this.node('Line', label, statement, {
          dialect: this.dialect,
          label: label.value,
          source: this.source.slice(this.lineStart, end),
          statement,
        }),
      );
    }
    return lines;
  }

  sequence(): Statement {
    const statements: SimpleStatement[] = [this.statement()];
    const separators: Location[] = [];
    while (this.at('PUNCTUATION', ':')) {
      const colon = this.take();
      if (statements.length === maxLineStatements)
        this.fail(
          'STATEMENT_LIMIT',
          `A line permits at most ${maxLineStatements} statements`,
          colon,
        );
      separators.push(this.location(colon));
      statements.push(this.statement());
    }
    return statements.length === 1
      ? statements[0]
      : this.node('StatementSequence', statements[0], statements.at(-1)!, {statements, separators});
  }

  statement(): SimpleStatement {
    const command = this.peek();
    if (this.atStatementEnd()) {
      this.fail('EXPECTED_STATEMENT', 'Expected a statement after the label');
    }
    if (this.lineStatementCount === maxLineStatements)
      this.fail('STATEMENT_LIMIT', `A line permits at most ${maxLineStatements} statements`);
    this.lineStatementCount++;
    if (command.type === 'IDENTIFIER') {
      const following = this.tokens[this.index + 1];
      // Like GO, DIM remains an ordinary native name outside this statement form.
      if (command.value === 'DIM' && following.type === 'IDENTIFIER') {
        this.take();
        return this.dimension(command);
      }
      if (
        (following.type === 'OPERATOR' && following.value === '=') ||
        (following.type === 'PUNCTUATION' &&
          following.value === '(' &&
          (command.value !== 'ON' || this.parenthesizedAssignment()))
      ) {
        this.take();
        return this.assignment(command, command);
      }
      // Contextual statement forms preserve these existing scalar/array names.
      if (command.value === 'DATA') {
        this.take();
        return this.data(command);
      }
      if (command.value === 'READ') {
        this.take();
        return this.read(command);
      }
      if (command.value === 'RESTORE') {
        this.take();
        return this.node('RestoreStatement', command, command, {});
      }
      if (command.value === 'GOSUB') {
        this.take();
        const target = this.jumpTarget();
        return this.node('GosubStatement', command, target, {target});
      }
      if (command.value === 'ON') {
        this.take();
        return this.dispatch(command);
      }
      if (command.value === 'RETURN') {
        this.take();
        return this.node('ReturnStatement', command, command, {});
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
        return this.isPrintUsing() ? this.printUsing(command) : this.print(command);
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
        if (this.conditionalDepth === maxConditionalDepth)
          this.fail(
            'CONDITIONAL_LIMIT',
            `Conditional nesting exceeds ${maxConditionalDepth}`,
            command,
          );
        this.conditionalDepth++;
        try {
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
          const transfer = this.peek();
          if (!this.at('KEYWORD', 'THEN') && !this.at('KEYWORD', 'GOTO'))
            this.fail('EXPECTED_TOKEN', 'Expected THEN or GOTO after the comparison');
          this.take();
          const consequent =
            transfer.value === 'GOTO' ? this.jumpTarget() : this.conditionalBranch();
          let alternate: NodeFields['InlineIfStatement']['alternate'] = null;
          if (this.atElse()) {
            this.take();
            alternate = this.conditionalBranch();
          }
          if (consequent.type === 'NumberLiteral' && alternate === null)
            return this.node('IfStatement', command, consequent, {condition, target: consequent});
          return this.node('InlineIfStatement', command, alternate ?? consequent, {
            condition,
            consequent,
            alternate,
          });
        } finally {
          this.conditionalDepth--;
        }
      }
      case 'INPUT': {
        let prompt: NodeOf<'StringLiteral'> | null = null;
        if (this.at('STRING')) {
          const text = this.expect('STRING', undefined, 'Expected a quoted prompt');
          prompt = this.node('StringLiteral', text, text, {value: text.value, raw: text.raw});
          this.expect('PUNCTUATION', ';', 'Expected ; after the INPUT prompt');
        }
        const targets: NodeFields['InputTargetsStatement']['targets'][number][] = [];
        for (;;) {
          if (targets.length === maxInputTargets)
            this.fail('INPUT_LIMIT', `INPUT permits at most ${maxInputTargets} targets`);
          const name = this.expect(
            'IDENTIFIER',
            undefined,
            'Expected a variable or array after INPUT',
          );
          targets.push(this.reference(name));
          if (!this.at('PUNCTUATION', ',')) break;
          this.take();
        }
        const target = targets[0];
        if (targets.length === 1 && target.type === 'Variable')
          return this.node('InputStatement', command, target, {prompt, target});
        return this.node('InputTargetsStatement', command, targets.at(-1)!, {prompt, targets});
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

  conditionalBranch(): NodeFields['InlineIfStatement']['consequent'] {
    if (this.at('NUMBER')) return this.jumpTarget();
    this.branchDepth++;
    try {
      const statement = this.statement();
      if (!inlineBodyAllowed(statement))
        this.fail(
          'UNSUPPORTED_BRANCH',
          'DIM, DATA, FOR and NEXT are unsupported as inline branch bodies',
          this.tokens[this.index - 1],
        );
      return statement;
    } finally {
      this.branchDepth--;
    }
  }

  assignment(command: Token, name: TokenOf<'IDENTIFIER'>): NodeOf<'LetStatement'> {
    const target = this.reference(name);
    this.expect('OPERATOR', '=', 'Expected = after the variable name');
    const expression = this.expression();
    return this.node('LetStatement', command, expression, {target, expression});
  }

  data(command: Token): NodeOf<'DataStatement'> {
    const items: (NodeOf<'NumberLiteral'> | NodeOf<'StringLiteral'>)[] = [];
    for (;;) {
      if (items.length === maxDataListItems)
        this.fail('DATA_LIMIT', `DATA permits at most ${maxDataListItems} items`);
      const first = this.peek();
      if (first.type === 'STRING') {
        this.take();
        items.push(this.node('StringLiteral', first, first, {value: first.value, raw: first.raw}));
      } else {
        let sign = '';
        if (this.at('OPERATOR', '+') || this.at('OPERATOR', '-')) sign = this.take().raw;
        const number = this.expect(
          'NUMBER',
          undefined,
          'Expected a numeric or quoted DATA literal',
        );
        items.push(
          this.node('NumberLiteral', first, number, {
            value: sign === '-' ? -number.value : number.value,
            raw: this.source.slice(
              first.start.offset - this.offset,
              number.end.offset - this.offset,
            ),
          }),
        );
      }
      if (!this.at('PUNCTUATION', ',')) break;
      this.take();
    }
    if (!this.atEnd())
      this.fail(
        'INVALID_DATA',
        'DATA must be the last statement on its line and contain only literals',
      );
    return this.node('DataStatement', command, items.at(-1)!, {items});
  }

  read(command: Token): NodeOf<'ReadStatement'> {
    const targets: NodeFields['ReadStatement']['targets'][number][] = [];
    for (;;) {
      if (targets.length === maxDataListItems)
        this.fail('DATA_LIMIT', `READ permits at most ${maxDataListItems} targets`);
      const name = this.expect('IDENTIFIER', undefined, 'Expected a variable or array after READ');
      targets.push(this.reference(name));
      if (!this.at('PUNCTUATION', ',')) break;
      this.take();
    }
    return this.node('ReadStatement', command, targets.at(-1)!, {targets});
  }

  dimension(command: Token): NodeOf<'DimStatement'> {
    const declarations: NodeOf<'ArrayDeclaration'>[] = [];
    for (;;) {
      const name = this.expect('IDENTIFIER', undefined, 'Expected an array name after DIM');
      this.expect('PUNCTUATION', '(', 'Expected ( after the array name');
      const bounds: NodeOf<'NumberLiteral'>[] = [];
      for (;;) {
        const bound = this.peek();
        if (
          bound.type !== 'NUMBER' ||
          !/^\d+$/.test(bound.raw) ||
          !Number.isSafeInteger(bound.value)
        ) {
          this.fail(
            'INVALID_DIMENSION',
            'Expected a nonnegative safe integer literal bound',
            bound,
          );
        }
        this.take();
        bounds.push(this.node('NumberLiteral', bound, bound, {value: bound.value, raw: bound.raw}));
        if (!this.at('PUNCTUATION', ',')) break;
        if (bounds.length === 2)
          this.fail('ARRAY_RANK_MISMATCH', 'Arrays support one or two dimensions');
        this.take();
      }
      const close = this.expect('PUNCTUATION', ')', 'Expected closing ) after array bounds');
      declarations.push(
        this.node('ArrayDeclaration', name, close, {
          name: name.value,
          nameLocation: this.location(name),
          bounds,
        }),
      );
      if (!this.at('PUNCTUATION', ',')) break;
      this.take();
    }
    return this.node('DimStatement', command, declarations[declarations.length - 1], {
      declarations,
    });
  }

  reference(name: TokenOf<'IDENTIFIER'>): NodeOf<'Variable'> | NodeOf<'ArrayReference'> {
    if (!this.at('PUNCTUATION', '(')) return this.node('Variable', name, name, {name: name.value});
    const open = this.take();
    return this.nested(open, () => {
      const indices: Expression[] = [this.expression()];
      if (this.at('PUNCTUATION', ',')) {
        this.take();
        indices.push(this.expression());
      }
      const close = this.expect('PUNCTUATION', ')', 'Expected closing ) after array indices');
      return this.node('ArrayReference', name, close, {
        name: name.value,
        nameLocation: this.location(name),
        indices,
      });
    });
  }

  goto(command: Token): NodeOf<'GotoStatement'> {
    const target = this.jumpTarget();
    return this.node('GotoStatement', command, target, {target});
  }

  dispatch(command: Token): NodeOf<'OnStatement'> {
    const selector = this.expression();
    const transfer = this.peek();
    if (!this.at('KEYWORD', 'GOTO') && !this.at('IDENTIFIER', 'GOSUB'))
      this.fail('EXPECTED_TOKEN', 'Expected GOTO or GOSUB after the ON selector');
    this.take();
    const targets: NodeOf<'NumberLiteral'>[] = [];
    for (;;) {
      if (targets.length === maxDispatchTargets)
        this.fail('DISPATCH_LIMIT', `ON permits at most ${maxDispatchTargets} targets`);
      targets.push(this.jumpTarget());
      if (!this.at('PUNCTUATION', ',')) break;
      this.take();
    }
    return this.node('OnStatement', command, targets.at(-1)!, {
      selector,
      transfer: transfer.value === 'GOTO' ? 'goto' : 'gosub',
      targets,
    });
  }

  parenthesizedAssignment(): boolean {
    // ON (expression) GOTO is a grouped selector, whereas ON(indices)=...
    // remains an existing array assignment. Scan only to the matching close.
    let depth = 0;
    for (let i = this.index + 1; ; i++) {
      const token = this.tokens[i];
      if (token.type === 'NEWLINE' || token.type === 'EOF') return false;
      if (token.type !== 'PUNCTUATION') continue;
      if (token.value === '(') depth++;
      if (token.value === ')' && --depth === 0) {
        const following = this.tokens[i + 1];
        return following.type === 'OPERATOR' && following.value === '=';
      }
    }
  }

  print(command: Token) {
    const items: Expression[] = [];
    const separators: Location[] = [];
    let trailingSemicolon = false;
    let last: Token | Expression = command;
    if (!this.atStatementEnd()) {
      let adjacent = false;
      for (;;) {
        const first = this.peek();
        last = this.expression();
        if (
          adjacent &&
          expressionType(items[items.length - 1]) !== 'string' &&
          expressionType(last) !== 'string'
        ) {
          this.fail('UNEXPECTED_TOKEN', `Unexpected token ${JSON.stringify(first.raw)}`, first);
        }
        items.push(last);
        if (this.branchDepth > 0 && this.atElse()) break;
        if (!this.at('PUNCTUATION', ';')) {
          const next = this.peek();
          // Operators still belong to the current expression; only a new
          // unsigned primary can start another top-level PRINT item.
          if (
            next.type !== 'NUMBER' &&
            next.type !== 'STRING' &&
            next.type !== 'IDENTIFIER' &&
            !(next.type === 'KEYWORD' && functions.has(next.value)) &&
            !this.at('PUNCTUATION', '(')
          )
            break;
          adjacent = true;
          continue;
        }
        adjacent = false;
        last = this.take();
        separators.push(this.location(last));
        if (this.atStatementEnd()) {
          trailingSemicolon = true;
          break;
        }
      }
    }
    return this.node('PrintStatement', command, last, {items, separators, trailingSemicolon});
  }

  isPrintUsing(): boolean {
    if (!this.at('IDENTIFIER', 'USING')) return false;
    let depth = 0;
    // Tokens always end in EOF. Only a top-level comma distinguishes this new
    // syntax from ordinary PRINT, including USING arrays and adjacent items.
    for (let index = this.index + 1; ; index++) {
      const token = this.tokens[index];
      if (
        token.type === 'NEWLINE' ||
        token.type === 'EOF' ||
        (token.type === 'PUNCTUATION' && token.value === ':') ||
        (this.branchDepth > 0 &&
          depth === 0 &&
          token.type === 'IDENTIFIER' &&
          token.value === 'ELSE')
      )
        return false;
      if (token.type !== 'PUNCTUATION') continue;
      if (token.value === '(') depth++;
      else if (token.value === ')') {
        if (depth === 0) return false;
        depth--;
      } else if (token.value === ',' && depth === 0) return true;
    }
  }

  printUsing(command: Token): NodeOf<'PrintUsingStatement'> {
    this.take(); // Contextual USING stays an ordinary native name elsewhere.
    const format = this.expression();
    const separator = this.expect('PUNCTUATION', ',', 'Expected , after the PRINT USING template');
    const separators = [this.location(separator)];
    const items: Expression[] = [];
    let last: Token | Expression;
    let trailingSemicolon = false;
    for (;;) {
      const first = this.peek();
      last = this.expression();
      items.push(last);
      if (items.length > maxPrintUsingValues) {
        this.fail(
          'FORMAT_LIMIT',
          `PRINT USING permits at most ${maxPrintUsingValues} values`,
          first,
        );
      }
      if (!this.at('PUNCTUATION', ',')) break;
      separators.push(this.location(this.take()));
    }
    if (this.at('PUNCTUATION', ';')) {
      last = this.take();
      separators.push(this.location(last));
      trailingSemicolon = true;
    }
    return this.node('PrintUsingStatement', command, last, {
      format,
      items,
      separators,
      trailingSemicolon,
    });
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
    return this.power();
  }

  power(): Expression {
    // Equal-precedence powers associate left; a sign after ^ applies only to
    // its operand. Recursing through unary() here would make 2^-2^2 group wrong.
    let left = this.primary();
    while (this.at('OPERATOR', '^')) {
      const operator = this.take();
      const right = this.powerOperand();
      left = this.node('BinaryExpression', left, right, {
        operator: '^',
        operatorLocation: this.location(operator),
        left,
        right,
      });
    }
    return left;
  }

  powerOperand(): Expression {
    if (this.at('OPERATOR', '+') || this.at('OPERATOR', '-')) {
      const operator = this.take();
      const argument = this.nested(operator, () => this.powerOperand());
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
      return this.reference(token);
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
