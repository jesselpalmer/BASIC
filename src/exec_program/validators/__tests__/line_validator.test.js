import {LineValidator} from '../line_validator.js';

describe('LineValidator', () => {
  it('accepts valid lines and rejects a repeated line number', () => {
    const validator = new LineValidator();
    expect(() => validator.validate('10 PRINT "first"')).not.toThrow();
    expect(() => validator.validate('20 REM "comment"')).not.toThrow();
    expect(() => validator.validate('10 PRINT "duplicate"')).toThrow(
        'Line number has been used 10',
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
        'Line number is not a valid number oops',
    );
    expect(() => validator.validate('10 PRINT "valid"')).not.toThrow();
  });
});
