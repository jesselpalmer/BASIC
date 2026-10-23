import int from '../int_command';

describe('INT', () => {
  let output;
  let error;

  beforeEach(() => {
    output = jest.spyOn(console, 'log').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['-1.6', -2],
    ['1.6180', 1],
    ['0', 0],
    ['-2', -2],
    ['0.9', 0],
    ['.5', 0],
    ['  -1.6  ', -2],
  ])('floors %s to %s', (source, expected) => {
    int(source);
    expect(output).toHaveBeenCalledWith(expected);
    expect(error).not.toHaveBeenCalled();
  });

  it.each([
    'not-a-number', '1.2oops', '', ' ', 'Infinity', undefined,
    '0x10', '0b10', '1e2',
  ])(
      'rejects invalid input %s', (source) => {
        int(source);
        expect(error).toHaveBeenCalledWith('Invalid number');
        expect(output).not.toHaveBeenCalled();
      },
  );
});
