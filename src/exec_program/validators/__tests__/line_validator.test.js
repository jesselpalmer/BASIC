import {LineValidator} from '../line_validator';

describe('LineValidator', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepts valid lines and rejects a repeated line number', () => {
    const validator = new LineValidator();
    expect(validator.isLineValid('10 PRINT "first"')).toBe(true);
    expect(validator.isLineValid('20 REM "comment"')).toBe(true);
    expect(validator.isLineValid('10 PRINT "duplicate"')).toBe(false);
  });

  it('does not share line numbers between validators', () => {
    const first = new LineValidator();
    const second = new LineValidator();
    expect(first.isLineValid('10 PRINT "first"')).toBe(true);
    expect(second.isLineValid('10 PRINT "second"')).toBe(true);
  });

  it('rejects a nonnumeric line without consuming a valid number', () => {
    const validator = new LineValidator();
    expect(validator.isLineValid('oops PRINT "invalid"')).toBe(false);
    expect(validator.isLineValid('10 PRINT "valid"')).toBe(true);
  });
});
