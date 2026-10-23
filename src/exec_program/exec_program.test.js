import ExecProgram from './exec_program';
import {mkdtempSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';

describe('ExecProgram line execution', () => {
  let output;

  beforeEach(() => {
    output = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('retains validation history across session lines', () => {
    const program = new ExecProgram();
    program.readLine('10 PRINT "first"');
    program.readLine('20 PRINT "second"');
    program.readLine('10 PRINT "duplicate"');
    expect(output).toHaveBeenCalledWith('first');
    expect(output).toHaveBeenCalledWith('second');
    expect(output).not.toHaveBeenCalledWith('duplicate');
    expect(output).toHaveBeenCalledWith(
        'INVALID: Line number has been used 10',
    );
  });

  it('keeps independent sessions isolated', () => {
    new ExecProgram().readLine('10 PRINT "session one"');
    new ExecProgram().readLine('10 PRINT "session two"');
    expect(output).toHaveBeenCalledWith('session one');
    expect(output).toHaveBeenCalledWith('session two');
  });

  it('isolates files opened concurrently by the same runner', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'basic-files-'));
    const firstFile = join(directory, 'first.bas');
    const secondFile = join(directory, 'second.bas');
    writeFileSync(firstFile, '10 PRINT "first file"\n');
    writeFileSync(secondFile, '10 PRINT "second file"\n');
    const program = new ExecProgram();
    try {
      await new Promise((resolve) => {
        const seen = new Set();
        output.mockImplementation((text) => {
          if (text === 'first file' || text === 'second file') seen.add(text);
          if (seen.size === 2) resolve();
        });
        program.start(firstFile);
        program.start(secondFile);
      });
      expect(output).toHaveBeenCalledWith('first file');
      expect(output).toHaveBeenCalledWith('second file');
      expect(output).not.toHaveBeenCalledWith(
          'INVALID: Line number has been used 10',
      );
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });
});
