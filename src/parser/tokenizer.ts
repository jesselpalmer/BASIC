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
import {historicalWord, scannerPolicy, type LexicalPolicy} from './lexical_policy.ts';
import {historicalNumericSpelling} from './historical_numeric.ts';

const digit = (character: string | undefined) => /[0-9]/.test(character ?? '');
const letter = (character: string | undefined) => /[A-Za-z]/.test(character ?? '');

// Positions count UTF-16 code units, matching JavaScript string offsets.
// End positions are exclusive; tabs count as one source column.
export function tokenize(
  source: string,
  options: SourceOptions & {numbered?: boolean; lexicalPolicy?: LexicalPolicy} = {},
): Token[] {
  return new Scanner(source, options).scan();
}

class Scanner {
  readonly policy: ReturnType<typeof scannerPolicy>;
  statementStart = true;
  statementWord: string | null = null;
  openConditionals = 0;
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
    {
      numbered = true,
      line = 1,
      offset = 0,
      lexicalPolicy,
    }: SourceOptions & {
      numbered?: boolean;
      lexicalPolicy?: LexicalPolicy;
    },
  ) {
    this.policy = scannerPolicy(lexicalPolicy);
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
        this.resetHistoricalClause();
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
        if (this.policy.compact && pair === '==')
          this.fail(
            'UNSUPPORTED_LEXICAL_FORM',
            'Historical approximate equality is not implemented',
          );
        const operator = ['<=', '>=', '<>'].includes(pair) ? pair : character;
        this.index += operator.length;
        this.emit('OPERATOR', start, operator);
      } else if ('();,:'.includes(character)) {
        const start = this.position();
        this.index++;
        this.emit('PUNCTUATION', start, character);
        if (character === ':' && this.policy.compact) this.resetHistoricalClause();
      } else {
        if (this.policy.compact && "'!\\%".includes(character))
          this.fail('UNSUPPORTED_LEXICAL_FORM', 'This historical lexical form is not implemented');
        const unexpected = String.fromCodePoint(this.source.codePointAt(this.index)!);
        this.fail('UNEXPECTED_CHARACTER', `Unexpected character ${JSON.stringify(unexpected)}`);
      }
    }
    this.emit('EOF', this.position(), null);
    return this.tokens;
  }

  resetHistoricalClause() {
    this.statementStart = true;
    this.statementWord = null;
    this.openConditionals = 0;
  }

  historicalWordAllowed(word: string): boolean {
    const entry = historicalWord(word, 0)!;
    if (entry.role === 'unsupported') return false;
    if (word === 'ELSE') return this.openConditionals > 0;
    if (this.statementStart) return entry.role === 'statement';
    if (entry.role === 'function') return true;
    if (word === 'TO' || word === 'STEP') return this.statementWord === 'FOR';
    if (word === 'THEN') return this.statementWord === 'IF';
    return (
      (word === 'GOTO' || word === 'GOSUB') &&
      (this.statementWord === 'ON' || this.statementWord === 'IF')
    );
  }

  acceptHistoricalWord(word: string) {
    if (!this.historicalWordAllowed(word))
      this.fail('UNSUPPORTED_LEXICAL_FORM', 'Unsupported or misplaced historical word');
    if (word === 'THEN' || word === 'ELSE') {
      if (word === 'ELSE') this.openConditionals--;
      this.statementStart = true;
      this.statementWord = null;
    } else if (this.statementStart || word === 'GOTO' || word === 'GOSUB') {
      this.statementStart = false;
      this.statementWord = word;
      if (word === 'IF') this.openConditionals++;
    }
  }

  readLabel() {
    const start = this.position();
    const beginning = this.index;
    while (
      this.index < this.source.length &&
      (this.policy.compact
        ? digit(this.source[this.index])
        : !/[ \t\r\n]/.test(this.source[this.index]))
    )
      this.index++;
    // Compact labels may meet a verb or optional-LET target, never punctuation.
    if (
      this.policy.compact &&
      this.index < this.source.length &&
      !letter(this.source[this.index]) &&
      !/[ \t\r\n]/.test(this.source[this.index])
    )
      while (this.index < this.source.length && !/[ \t\r\n]/.test(this.source[this.index]))
        this.index++;
    const raw = this.source.slice(beginning, this.index);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || value < 1 || value > this.policy.maximumLabel) {
      this.fail(
        'INVALID_LABEL',
        `Invalid line label ${JSON.stringify(raw)}; expected 1 through ${this.policy.maximumLabel}`,
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
        if (this.policy.compact || this.source[this.index] !== '"') {
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
    if (this.policy.compact) this.readCompactNumber();
    // Consume the whole native numeric-looking word, never a valid prefix of 12oops.
    else
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
    let value = Number(raw);
    if (this.policy.compact) {
      try {
        value = historicalNumericSpelling(raw).value;
      } catch (error) {
        if (error instanceof RangeError)
          this.fail(
            'UNSUPPORTED_LEXICAL_FORM',
            'Historical integer literal range is unsupported',
            start,
          );
        this.fail('INVALID_NUMBER', `Invalid decimal literal ${JSON.stringify(raw)}`, start);
      }
    } else if (!numericLiteral.test(raw) || !Number.isFinite(value)) {
      this.fail('INVALID_NUMBER', `Invalid decimal literal ${JSON.stringify(raw)}`, start);
    }
    if (this.policy.compact) {
      const word = historicalWord(this.source, this.index);
      if (word && !this.historicalWordAllowed(word.word))
        this.fail('UNSUPPORTED_LEXICAL_FORM', 'Unsupported or misplaced historical word');
    }
    this.emit('NUMBER', start, value);
    if (this.policy.compact) this.statementStart = false;
  }

  readCompactNumber() {
    while (digit(this.source[this.index])) this.index++;
    if (this.source[this.index] === '.') {
      this.index++;
      while (digit(this.source[this.index])) this.index++;
    }
    if (this.source[this.index] === 'e')
      this.fail('UNSUPPORTED_LEXICAL_FORM', 'Lowercase historical spelling is not implemented');
    // ELSE/END start new words; an E exponent remains part of its number.
    if (this.source[this.index] === 'E' && !historicalWord(this.source, this.index)) {
      this.index++;
      if (this.source[this.index] === '+' || this.source[this.index] === '-') this.index++;
      while (digit(this.source[this.index])) this.index++;
    }
    if (this.source[this.index] === '%') {
      this.index++;
      // A second suffix or numeric continuation cannot become a second token.
      if (/[0-9.$%]/.test(this.source[this.index] ?? '')) {
        while (this.index < this.source.length && /[A-Za-z0-9.$%]/.test(this.source[this.index]))
          this.index++;
      }
    }
    const following = this.source[this.index];
    if (
      following === '.' ||
      following === '$' ||
      (letter(following) && !historicalWord(this.source, this.index))
    )
      while (this.index < this.source.length && /[A-Za-z0-9.$]/.test(this.source[this.index]))
        this.index++;
  }

  readName() {
    const start = this.position();
    const beginning = this.index;
    let historicalKeyword = false;
    if (this.policy.compact) {
      if (this.source[this.index] !== this.source[this.index].toUpperCase())
        this.fail(
          'UNSUPPORTED_LEXICAL_FORM',
          'Lowercase historical spelling is not implemented',
          start,
        );
      const word = historicalWord(this.source, this.index);
      if (word) {
        this.acceptHistoricalWord(word.word);
        this.index += word.word.length;
        historicalKeyword = true;
      } else {
        this.index++;
        if (digit(this.source[this.index])) this.index++;
        if (this.source[this.index] === '$' || this.source[this.index] === '%') this.index++;
        if (this.source[this.index] === '$' || this.source[this.index] === '%')
          this.fail('UNSUPPORTED_LEXICAL_FORM', 'Expected one historical name suffix', start);
        const nextWord = historicalWord(this.source, this.index);
        if (
          digit(this.source[this.index]) ||
          (letter(this.source[this.index]) &&
            (!nextWord || !this.historicalWordAllowed(nextWord.word)))
        )
          this.fail(
            'UNSUPPORTED_LEXICAL_FORM',
            'Expected a short historical name or documented word',
            start,
          );
        if (this.statementStart) {
          let next = this.index;
          while (this.source[next] === ' ' || this.source[next] === '\t') next++;
          if (this.source[next] !== '=' && this.source[next] !== '(')
            this.fail(
              'UNSUPPORTED_LEXICAL_FORM',
              'Expected a historical assignment target or statement',
              start,
            );
          this.statementStart = false;
          this.statementWord = 'LET';
        }
      }
    } else {
      this.index++;
      while (letter(this.source[this.index]) || digit(this.source[this.index])) this.index++;
      if (this.source[this.index] === '$') this.index++;
    }
    const value = this.source.slice(beginning, this.index).toUpperCase();
    const type = (this.policy.compact ? historicalKeyword : reservedWords.has(value))
      ? 'KEYWORD'
      : 'IDENTIFIER';
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
