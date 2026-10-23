import {LineValidator} from '../line_validator.js';

describe('LineValidator', () => {
  it('accepts valid lines and rejects a repeated line number', () => {
    const validator = new LineValidator();
    expect(() => validator.validate('10 PRINT "first"')).not.toThrow();
    expect(() => validator.validate('20 REM "comment"')).not.toThrow();
    expect(() => validator.validate('10 PRINT "duplicate"')).toThrow(
        'Duplicate line label 10',
    );
  });

  it('does not share line numbers between validators', () => {
    new LineValidator().validate('10 PRINT "first"');
    expect(() => new LineValidator().validate('10 PRINT "second"'))
        .not.toThrow();
  });

  it('rejects a nonnumeric line without consuming a valid number', () => {
    const validator = new LineValidator();
    expect(() => validator.validate('oops PRINT "invalid"')).toThrow(
        'Invalid line label "oops"',
    );
    expect(() => validator.validate('10 PRINT "valid"')).not.toThrow();
  });

  it('treats leading-zero labels as the same number', () => {
    const validator = new LineValidator();
    validator.validate('010 PRINT "first"');
    expect(() => validator.validate('10 END'))
        .toThrow('Duplicate line label 10');
  });

  it('does not reserve labels from a failed tokenization or blank line', () => {
    const validator = new LineValidator();
    validator.validate('\t \r\n');
    expect(() => validator.validate('10 PRINT "bad')).toThrow(
        'Unterminated string',
    );
    expect(() => validator.validate('10 PRINT "fixed"')).not.toThrow();
  });
});
