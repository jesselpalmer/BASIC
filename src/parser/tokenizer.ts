import type {
  Position,
  SourceOptions,
  Token,
  TokenOf,
  TokenType,
  TokenValues,
} from '../core/types.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {reservedWords} from '../dictionaries/reserved_words.ts';
import {numericLiteral} from '../core/numeric_literal.ts';

const digit = (character: string | undefined) => /[0-9]/.test(character ?? '');
const letter = (character: string | undefined) => /[A-Za-z]/.test(character ?? '');

// Positions count UTF-16 code units, matching JavaScript string offsets.
// End positions are exclusive; tabs count as one source column.
export function tokenize(
  source: string,
  options: SourceOptions & {numbered?: boolean} = {},
): Token[] {
  return new Scanner(source, options).scan();
}

class Scanner {
  source: string;
  numbered: boolean;
  line: number;
  offset: number;
  index: number;
  lineStart: number;
  beginning: boolean;
  label: number | null;
  tokens: Token[];
  constructor(
    source: string,
    {numbered = true, line = 1, offset = 0}: SourceOptions & {numbered?: boolean},
  ) {
    this.source = source;
    this.numbered = numbered;
    this.line = line;
    this.offset = offset;
    this.index = 0;
    this.lineStart = 0;
    this.beginning = true;
    this.label = null;
    this.tokens = [];
  }

  position() {
    return {
      line: this.line,
      column: this.index - this.lineStart + 1,
      offset: this.offset + this.index,
    };
  }

  emit<K extends TokenType>(type: K, start: Position, value: TokenValues[K]) {
    this.tokens.push({
      type,
      value,
      label: this.label,
      raw: this.source.slice(start.offset - this.offset, this.index),
      start,
      end: this.position(),
    } as TokenOf<K> as Token);
  }

  fail(code: string, message: string, position = this.position()): never {
    throw new BasicSyntaxError(code, message, position, this.label);
  }

  scan() {
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      if (character === ' ' || character === '\t') {
        this.index++;
        continue;
      }
      if (character === '\n' || (character === '\r' && this.source[this.index + 1] === '\n')) {
        const start = this.position();
        this.index += character === '\r' ? 2 : 1;
        this.line++;
        this.lineStart = this.index;
        this.emit('NEWLINE', start, null);
        this.label = null;
        this.beginning = true;
        continue;
      }
      if (this.beginning) {
        this.beginning = false;
        if (this.numbered) {
          this.readLabel();
          continue;
        }
      }
      if (character === '"') {
        this.readString();
      } else if (digit(character) || character === '.') {
        this.readNumber();
      } else if (letter(character)) {
        this.readName();
      } else if ('+-*/^=<>'.includes(character)) {
        const start = this.position();
        const pair = this.source.slice(this.index, this.index + 2);
        const operator = ['<=', '>=', '<>'].includes(pair) ? pair : character;
        this.index += operator.length;
        this.emit('OPERATOR', start, operator);
      } else if ('();,'.includes(character)) {
        const start = this.position();
        this.index++;
        this.emit('PUNCTUATION', start, character);
      } else {
        const unexpected = String.fromCodePoint(this.source.codePointAt(this.index)!);
        this.fail('UNEXPECTED_CHARACTER', `Unexpected character ${JSON.stringify(unexpected)}`);
      }
    }
    this.emit('EOF', this.position(), null);
    return this.tokens;
  }

  readLabel() {
    const start = this.position();
    const beginning = this.index;
    while (this.index < this.source.length && !/[ \t\r\n]/.test(this.source[this.index]))
      this.index++;
    const raw = this.source.slice(beginning, this.index);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || value < 1 || value > 65535) {
      this.fail(
        'INVALID_LABEL',
        `Invalid line label ${JSON.stringify(raw)}; expected 1 through 65535`,
        start,
      );
    }
    this.label = value;
    this.emit('LABEL', start, value);
  }

  readString() {
    const start = this.position();
    this.index++;
    let value = '';
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      if (character === '\r' || character === '\n') break;
      this.index++;
      if (character === '"') {
        if (this.source[this.index] !== '"') {
          this.emit('STRING', start, value);
          return;
        }
        this.index++;
      }
      value += character;
    }
    this.fail('UNTERMINATED_STRING', 'Unterminated string', start);
  }

  readNumber() {
    const start = this.position();
    const beginning = this.index;
    // Consume the whole numeric-looking word, never a valid prefix of 12oops.
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      if (
        /[A-Za-z0-9.$]/.test(character) ||
        ((character === '+' || character === '-') && /[Ee]/.test(this.source[this.index - 1]))
      )
        this.index++;
      else break;
    }
    const raw = this.source.slice(beginning, this.index);
    const value = Number(raw);
    if (!numericLiteral.test(raw) || !Number.isFinite(value)) {
      this.fail('INVALID_NUMBER', `Invalid decimal literal ${JSON.stringify(raw)}`, start);
    }
    this.emit('NUMBER', start, value);
  }

  readName() {
    const start = this.position();
    const beginning = this.index++;
    while (letter(this.source[this.index]) || digit(this.source[this.index])) {
      this.index++;
    }
    if (this.source[this.index] === '$') this.index++;
    const value = this.source.slice(beginning, this.index).toUpperCase();
    const type = reservedWords.has(value) ? 'KEYWORD' : 'IDENTIFIER';
    this.emit(type, start, value);
    if (value === 'REM') {
      const comment = this.position();
      const beginning = this.index;
      while (this.index < this.source.length && !/[\r\n]/.test(this.source[this.index]))
        this.index++;
      this.emit('COMMENT', comment, this.source.slice(beginning, this.index));
    }
  }
}
