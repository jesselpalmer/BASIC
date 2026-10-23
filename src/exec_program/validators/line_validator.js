import {BasicSyntaxError} from '../../core/diagnostic.js';
import {tokenize} from '../../parser/tokenizer.js';

export class LineValidator {
  constructor() {
    this._usedLineNumbers = new Set();
  }

  validate(line, location = {}) {
    const tokens = tokenize(line, location);
    const [label, extra] = tokens.filter((token) => token.type === 'LABEL');
    if (!label) return tokens;
    if (extra) {
      throw new BasicSyntaxError('INVALID_STATEMENT',
          'Expected one numbered statement', extra.start, extra.value);
    }
    if (this._usedLineNumbers.has(label.value)) {
      throw new BasicSyntaxError('DUPLICATE_LABEL',
          `Duplicate line label ${label.value}`, label.start, label.value);
    }
    this._usedLineNumbers.add(label.value);
    return tokens;
  }
}
