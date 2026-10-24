import type {SourceOptions} from '../../core/types.ts';
import {BasicSyntaxError} from '../../core/diagnostic.ts';
import {tokenize} from '../../parser/tokenizer.ts';

export class LineValidator {
  _usedLineNumbers: Set<number>;
  constructor() {
    this._usedLineNumbers = new Set();
  }

  validate(line: string, location: SourceOptions = {}) {
    const tokens = tokenize(line, location);
    const [label, extra] = tokens.filter((token) => token.type === 'LABEL');
    if (!label) return tokens;
    if (extra) {
      throw new BasicSyntaxError(
        'INVALID_STATEMENT',
        'Expected one numbered statement',
        extra.start,
        extra.value,
      );
    }
    if (this._usedLineNumbers.has(label.value)) {
      throw new BasicSyntaxError(
        'DUPLICATE_LABEL',
        `Duplicate line label ${label.value}`,
        label.start,
        label.value,
      );
    }
    this._usedLineNumbers.add(label.value);
    return tokens;
  }
}
