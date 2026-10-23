import ExecProgram from './exec_program';

describe('ExecProgram lifecycle', () => {
  let write;
  let program;

  beforeEach(() => {
    write = jest.fn();
    program = new ExecProgram({write});
  });

  it('retains validation history across session lines', () => {
    program.readLine('10 PRINT "first"');
    program.readLine('20 PRINT "second"');
    expect(() => program.readLine('10 PRINT "duplicate"')).toThrow(
        'Line number has been used 10',
    );
    expect(write.mock.calls).toEqual([['first\n'], ['second\n']]);
    expect(program.status).toBe('error');
  });

  it('keeps independent sessions isolated', () => {
    program.readLine('10 PRINT "session one"');
    new ExecProgram({write}).readLine('10 PRINT "session two"');
    expect(write.mock.calls).toEqual([['session one\n'], ['session two\n']]);
  });

  it('END halts the run without executing subsequent statements', () => {
    const result = program.run('10 PRINT "before"\n20 END\n30 PRINT "after"');
    expect(result).toEqual({status: 'halted'});
    program.readLine('40 PRINT "still stopped"');
    expect(write.mock.calls).toEqual([['before\n']]);
  });

  it('starts each run with independent validation and completion state', () => {
    program.run('10 PRINT "first"\n20 END');
    program.run('10 PRINT "second"\n');
    expect(write.mock.calls).toEqual([['first\n'], ['second\n']]);
    expect(program.status).toBe('halted');
  });

  it('halts on an error and can be explicitly reset or rerun', () => {
    expect(() => program.run('10 INT "bad"\n20 PRINT "skipped"'))
        .toThrow('Invalid number');
    expect(program.status).toBe('error');
    program.readLine('30 PRINT "also skipped"');
    expect(write).not.toHaveBeenCalled();
    program.reset();
    program.readLine('10 PRINT "recovered"');
    program.run('10 PRINT "rerun"');
    expect(write.mock.calls).toEqual([['recovered\n'], ['rerun\n']]);
  });

  it('finishes an empty program without host interaction', () => {
    expect(program.run('\n \r\n')).toEqual({status: 'halted'});
    expect(write).not.toHaveBeenCalled();
  });
});
